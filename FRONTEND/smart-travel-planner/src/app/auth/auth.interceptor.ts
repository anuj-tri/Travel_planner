import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError, finalize } from 'rxjs';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<boolean | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const isBackendRequest =
        req.url.startsWith('/auth/') ||
        req.url === '/auth' ||
        req.url.startsWith('/trips/') ||
        req.url === '/trips' ||
        req.url.startsWith('/encryption/') ||
        req.url === '/encryption';

    if (!isBackendRequest) {
        return next(req);
    }
    const credentialedReq = req.clone({
        withCredentials: true,
    });

    // Do not try to refresh if login, refresh, or logout itself fails.
    const isAuthRequest =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/logout');


    return next(credentialedReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status !== 401 || isAuthRequest) {
                return throwError(() => error);
            }

            //if another request is already refreshing, wait for it.
            if (isRefreshing){
                return refreshSubject.pipe(
                    filter((result): result is boolean => result !== null),
                    take(1),
                    switchMap((success) =>{
                        if (!success) {
                            return throwError(() => error);
                        }
                        return next(
                            req.clone({
                                withCredentials:true
                            })
                        )
                    })
                );
            }

            isRefreshing = true;
            refreshSubject.next(null);


            return authService.refreshToken().pipe(
                switchMap(() => {
                    refreshSubject.next(true);

                    //retry the original request after refresh succeeds.
                    return next(
                        req.clone({
                            withCredentials: true,
                        })
                    );
                }),
                catchError((refreshError) => {
                    refreshSubject.next(false);

                    authService.clearTokens();
                    void router.navigate(['/login']);

                    return throwError(() => refreshError);
                }),
                finalize(() => {
                    isRefreshing = false;
                })
            );
        })
    );
};


import { inject } from '@angular/core';

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';

import { Router } from '@angular/router';

import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const isAuthRequest =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/logout');

        const token = isAuthRequest ? null : authService.getAccessToken();

        const authReq = token
            ? req.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`,
                },
              })
            : req;
        return next(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status !== 401 || isAuthRequest) {
                    return throwError(() => error);
                }
                return authService.refreshToken().pipe(
                    switchMap((tokens) => {
                        const retryReq = req.clone({
                            setHeaders: { Authorization : `Bearer ${tokens.access_token}`
                            },
                        });
                        return next(retryReq);
                    }),
                    catchError((refreshError) => {
                        authService.clearTokens();
                        void router.navigate(['/login']);

                        return throwError(() => refreshError);

                    })
                )
            })
        )
}


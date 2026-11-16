import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // resuse the in-memory state when the session is already verified.
    if(authService.isLoggedIn()) {
        return true;
    }

    return authService.checkSession().pipe(
        map(() => true),
        catchError(() => {
            authService.clearTokens();
            return of(router.createUrlTree(['/login']));
        })
    );
};

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap} from 'rxjs';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    message: string;
    email: string;
}

export interface AuthResponse {
    message: string;
}

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    private readonly apiUrl = '/auth';
    private authenticated = false;

    constructor(private http: HttpClient) {}

    // now this one will login and store both token

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http
            .post<LoginResponse>(`${this.apiUrl}/login`, credentials, { withCredentials: true})
            .pipe(
                tap(() => {
                    this.authenticated= true;
                }),
            );
    }

    //check session
    checkSession(): Observable<unknown> {
        return this.http
            .get(`${this.apiUrl}/me`, {withCredentials: true})
            .pipe(
                tap(() => {
                    this.authenticated = true;
                })
            );
    }

    //refrsh access token
    refreshToken(): Observable<AuthResponse> {
        return this.http
            .post<AuthResponse>(
                `${this.apiUrl}/refresh`,
                {},
                { withCredentials: true }
            );
    }

    //logout
    logout(): Observable<AuthResponse> {
        return this.http
            .post<AuthResponse>(
                `${this.apiUrl}/logout`,
                {},
                { withCredentials: true }
            )
            .pipe(
                tap(() => {
                    this.clearTokens();
                })
            );
    }

    //clear loal authentication state.
    clearTokens(): void {
    this.authenticated = false;
    }

    //check in memory login state
    isLoggedIn(): boolean {
        return this.authenticated;
    }

}

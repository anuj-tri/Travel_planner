import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap} from 'rxjs';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type?: string;
}

export interface LoginResponse extends TokenResponse {
    message: string;
    email: string;
}

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    private readonly apiUrl = 'http://localhost:8000/auth';
    private readonly ACCESS_TOKEN_KEY ='access_token';
    private readonly REFRESH_TOKEN_KEY ='refrsh_token';

    constructor(private http: HttpClient) {}

    // now this one will login and store both token

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http
            .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
            .pipe(
                tap((response) => {
                    this.storeTokens(response);
                }),
            );
    }

    //it will read the access token
    getAccessToken(): string | null {
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }

    //read thye current refresh token.
    private getRefreshToken(): string | null {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    //store or replace both token
    private storeTokens(token: TokenResponse): void {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, token.access_token);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, token.refresh_token);
    }

    refreshToken(): Observable<TokenResponse> {
        const refreshToken = this.getRefreshToken();

        if(!refreshToken) {
            throw new Error('No refresh token available.');
        }

        return this.http
            .post<TokenResponse>(`${this.apiUrl}/refresh`,{
                refresh_token: refreshToken,
            })
            .pipe(
                tap((response) =>{
                    this.storeTokens(response);
                })
            );
    }
    logout(): Observable<unknown> {
        const refreshToken = this.getRefreshToken();

        if(!refreshToken){
            this.clearTokens();
            return new Observable((subscriber) => {
                subscriber.next(null);
                subscriber.complete();
            });
        }

        return this.http.post(`${this.apiUrl}/logout`,{
            refresh_token: refreshToken,
        })
        .pipe(
            tap(() => {
                this.clearTokens();
            }),
        );
    }

    //clearing boith the token stored tokens.
    clearTokens(): void {
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    }

    isLoggedIn(): boolean {
        return !!this.getAccessToken();
    }

}

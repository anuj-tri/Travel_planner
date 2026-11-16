import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable, map } from 'rxjs';
import * as forge from 'node-forge';

interface PublicKeyResponse {
  public_key: string;
}

@Injectable({
  providedIn: 'root',
})
export class Encryption {
  // Stores the imported RSA public key in memory
  private publicKey: ReturnType<typeof forge.pki.publicKeyFromPem> | null = null;

  constructor(private http: HttpClient) {}

  // Fetch public key from FastAPI
  private fetchPublicKey(): Observable<string> {
    return this.http
      .get<PublicKeyResponse>('/encryption/public-key')
      .pipe(map((response) => response.public_key));
  }

  // Convert PEM into a Node Forge public key
  private importPublicKey(pem: string): ReturnType<typeof forge.pki.publicKeyFromPem> {
    return forge.pki.publicKeyFromPem(pem);
  }

  // Fetch and cache the imported public key
  private async getPublicKey(): Promise<ReturnType<typeof forge.pki.publicKeyFromPem>> {
    // Return cached key if already available
    if (this.publicKey) {
      return this.publicKey;
    }

    // Fetch PEM key from backend
    const pem = await firstValueFrom(this.fetchPublicKey());

    // Import and cache the public key
    this.publicKey = this.importPublicKey(pem);

    return this.publicKey;
  }


  // Encrypt password using RSA-OAEP with SHA-256
  async encryptPassword(password: string): Promise<string> {
    // Get imported public key
    const publicKey = await this.getPublicKey();

    // Convert password into UTF-8 bytes
    const passwordBytes = forge.util.encodeUtf8(password);

    // Calculate maximum supported plaintext length
    const keyBytes = Math.ceil(publicKey.n.bitLength() / 8);
    const maxLength = keyBytes - 2 * 32 - 2;

    // Validate password length
    if (passwordBytes.length > maxLength) {
      throw new Error(`Password exceeds the maximum supported length of ${maxLength} bytes`);
    }

    // Encrypt using RSA-OAEP with SHA-256 and MGF1 SHA-256
    const encryptedBytes = publicKey.encrypt(passwordBytes, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    });

    // Convert encrypted bytes into Base64
    return forge.util.encode64(encryptedBytes);
  }
}

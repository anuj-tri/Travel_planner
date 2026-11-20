import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Encryption } from '../../services/encryption';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  firstName: string = '';
  lastName: string = '';
  email: string = '';

  isEditing: boolean = false;
  originalFirstName: string = '';
  originalLastName: string = '';

  successMessage: string = '';

  firstNameError: string = '';
  lastNameError: string = '';

  isLoading: boolean = true;
  isSaving: boolean = false;

  currentPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';

  currentPasswordError: string = '';
  newPasswordError: string = '';
  confirmNewPasswordError: string = '';

  isChangingPassword: boolean = false;
  passwordSuccessMessage: string = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmNewPassword = false;

  // DELETE ACCOUNT
  showDeleteAccountDialog = false;
  deleteAccountPassword = '';

  deleteAccountPasswordError = '';
  deleteAccountError = '';

  isDeletingAccount = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private encryption: Encryption,
    private router: Router,
  ) {}

  // COMPONENT INITIALIZATION
  ngOnInit(): void {
    this.getCurrentUser();
  }

  // CHECK PROFILE CHANGES
  get hasChanges(): boolean {
    return this.firstName !== this.originalFirstName || this.lastName !== this.originalLastName;
  }

  // GET CURRENT USER
  getCurrentUser(): void {
    this.http.get<any>('/auth/me', { withCredentials: true }).subscribe({
      next: (response) => {
        console.log('Current user:', response);

        this.firstName = response.first_name;
        this.lastName = response.last_name;
        this.email = response.email;

        this.originalFirstName = response.first_name;
        this.originalLastName = response.last_name;

        this.isLoading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Failed to get current user:', error);

        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // EDIT OR SAVE PROFILE
  editOrSave(): void {
    // FIRST CLICK → ENABLE EDITING
    if (!this.isEditing) {
      this.isEditing = true;
      this.successMessage = '';
      this.firstNameError = '';
      this.lastNameError = '';

      return;
    }

    // CLEAR OLD VALIDATION ERRORS
    this.firstNameError = '';
    this.lastNameError = '';

    // REMOVE EXTRA SPACES FROM NAMES
    this.firstName = this.firstName.trim();
    this.lastName = this.lastName.trim();

    // VALIDATE FIRST NAME
    if (!this.firstName) {
      this.firstNameError = 'Please fill in first name.';
    } else if (!/^[A-Za-z]+$/.test(this.firstName)) {
      this.firstNameError = 'First name can contain alphabets only';
    }

    // VALIDATE LAST NAME
    if (!this.lastName) {
      this.lastNameError = 'Please fill in last name.';
    } else if (!/^[A-Za-z]+$/.test(this.lastName)) {
      this.lastNameError = 'Last name can contain alphabets only';
    }

    // STOP IF VALIDATION FAILED
    if (this.firstNameError || this.lastNameError) {
      return;
    }

    // CHECK WHETHER ANYTHING CHANGED
    if (!this.hasChanges) {
      this.isEditing = false;
      return;
    }

    // DATA SENT TO BACKEND
    const updatedProfile = {
      first_name: this.firstName,
      last_name: this.lastName,
    };

    // PREVENT MULTIPLE SAVE CLICKS
    this.isSaving = true;

    // UPDATE PROFILE API
    this.http.patch<any>('/auth/me', updatedProfile, { withCredentials: true }).subscribe({
      next: (response) => {
        console.log('Profile updated successfully:', response);

        // UPDATE DISPLAYED VALUES
        this.firstName = response.first_name;
        this.lastName = response.last_name;

        // UPDATE ORIGINAL VALUES
        this.originalFirstName = response.first_name;
        this.originalLastName = response.last_name;

        // EXIT EDITING MODE
        this.isEditing = false;

        // STOP SAVING STATE
        this.isSaving = false;

        // SHOW SUCCESS MESSAGE
        this.successMessage = 'Name changed successfully!';

        this.cdr.detectChanges();

        // REFRESH PAGE AFTER 2 SECONDS
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      },

      error: (error) => {
        console.error('Failed to update profile:', error);

        this.isSaving = false;
        this.cdr.detectChanges();
      },
    });
  }

  // CHANGE PASSWORD WITH RSA ENCRYPTION
  async changePassword(): Promise<void> {
    // PREVENT MULTIPLE SUBMISSIONS
    if (this.isChangingPassword) {
      return;
    }

    // CLEAR OLD ERRORS
    this.currentPasswordError = '';
    this.newPasswordError = '';
    this.confirmNewPasswordError = '';
    this.passwordSuccessMessage = '';

    // DO NOT TRIM PASSWORDS.
    // SPACES MAY BE VALID PASSWORD CHARACTERS.

    // CURRENT PASSWORD VALIDATION
    if (!this.currentPassword) {
      this.currentPasswordError = 'Please enter your current password.';
    }

    // NEW PASSWORD VALIDATION
    if (!this.newPassword) {
      this.newPasswordError = 'Please enter a new password.';
    }

    // CONFIRM PASSWORD VALIDATION
    if (!this.confirmNewPassword) {
      this.confirmNewPasswordError = 'Please confirm your new password.';
    }

    // NEW PASSWORD MUST BE DIFFERENT FROM CURRENT PASSWORD
    if (this.currentPassword && this.newPassword && this.currentPassword === this.newPassword) {
      this.newPasswordError = 'New password must be different from your current password.';
    }

    // CHECK PASSWORD MATCH
    if (
      this.newPassword &&
      this.confirmNewPassword &&
      this.newPassword !== this.confirmNewPassword
    ) {
      this.confirmNewPasswordError = 'New password and confirm password do not match.';
    }

    // STOP IF VALIDATION FAILED
    if (this.currentPasswordError || this.newPasswordError || this.confirmNewPasswordError) {
      return;
    }

    // START LOADING STATE
    this.isChangingPassword = true;

    try {
      // ENCRYPT CURRENT PASSWORD
      const encryptedCurrentPassword = await this.encryption.encryptPassword(this.currentPassword);

      // ENCRYPT NEW PASSWORD
      const encryptedNewPassword = await this.encryption.encryptPassword(this.newPassword);

      // ENCRYPT CONFIRM PASSWORD
      const encryptedConfirmPassword = await this.encryption.encryptPassword(
        this.confirmNewPassword,
      );

      // CLEAR PLAINTEXT PASSWORDS FROM COMPONENT STATE
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';

      // REQUEST BODY CONTAINS ONLY ENCRYPTED PASSWORDS
      const changePasswordData = {
        current_password: encryptedCurrentPassword,

        new_password: encryptedNewPassword,

        confirm_new_password: encryptedConfirmPassword,
      };

      // CALL CHANGE PASSWORD API
      this.http
        .patch<any>('/auth/me/change-password', changePasswordData, { withCredentials: true })
        .subscribe({
          // SUCCESS
          next: (response) => {
            console.log('Password changed successfully:', response);

            this.isChangingPassword = false;

            this.passwordSuccessMessage = 'Password changed successfully.';

            this.cdr.detectChanges();

            setTimeout(() => {
              window.location.reload();
            }, 1900);
          },

          // API ERROR
          error: (error) => {
            console.error('Failed to change password:', error);

            this.isChangingPassword = false;

            const errorMessage = error.error?.detail;

            // WRONG CURRENT PASSWORD
            if (
              errorMessage === 'Current password is incorrect' ||
              errorMessage === 'Current password is incorrect.'
            ) {
              this.currentPasswordError = 'Current password is incorrect.';
            }

            // NEW PASSWORD CONFIRMATION MISMATCH
            else if (errorMessage === 'New password and confirm password do not match.') {
              this.confirmNewPasswordError = 'New password and confirm password do not match.';
            }

            // GENERIC ERROR
            else {
              console.error('Unexpected password change error:', errorMessage);
            }

            this.cdr.detectChanges();
          },
        });
    } catch (error) {
      // ENCRYPTION ERROR
      console.error('Password encryption failed:', error);

      this.isChangingPassword = false;

      // CLEAR REMAINING PLAINTEXT PASSWORDS
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';

      this.currentPasswordError = 'Unable to secure your password. Please try again.';

      this.cdr.detectChanges();
    }
  }

  //open dleete account dialog
  openDeleteAccountDialog(): void {
    this.showDeleteAccountDialog = true;

    this.deleteAccountPassword = '';
    this.deleteAccountPasswordError = '';
    this.deleteAccountError = '';

    this.cdr.detectChanges();
  }

  // CANCEL DELETE ACCOUNT
  cancelDeleteAccount(): void {
    if (this.isDeletingAccount) {
      return;
    }

    this.showDeleteAccountDialog = false;
    this.deleteAccountPassword = '';

    this.deleteAccountPasswordError = '';
    this.deleteAccountError = '';

    this.cdr.detectChanges();
  }

  // DELETE ACCOUNT
  async deleteAccount(): Promise<void> {
    if (this.isDeletingAccount) {
      return;
    }

    this.deleteAccountPasswordError = '';
    this.deleteAccountError = '';

    if (!this.deleteAccountPassword) {
      this.deleteAccountPasswordError = 'Please enter your current password.';
      return;
    }

    this.isDeletingAccount = true;

    try {
      // Encrypt current password using existing RSA service.
      const encryptedPassword = await this.encryption.encryptPassword(this.deleteAccountPassword);

      // Clear plaintext password from component state.
      this.deleteAccountPassword = '';

      // Call existing backend DELETE endpoint.
      this.http
        .delete<any>('/auth/me', {
          body: {
            current_password: encryptedPassword,
          },
          withCredentials: true,
        })
        .subscribe({
          next: (response) => {
            console.log('Account deleted successfully:', response);

            this.isDeletingAccount = false;
            this.showDeleteAccountDialog = false;

            this.cdr.detectChanges();

            // Navigate to login after successful deletion.
            this.router.navigate(['/login']);
          },

          error: (error) => {
            console.error('Account deletion failed:', error);

            this.isDeletingAccount = false;

            const errorMessage = error.error?.detail;

            if (errorMessage === 'Current password is incorrect') {
              this.deleteAccountPasswordError = 'Current password is incorrect.';
            } else if (errorMessage === 'User account not found') {
              this.deleteAccountError = 'Your account could not be found.';
            } else {
              this.deleteAccountError = 'Unable to delete your account. Please try again.';
            }

            this.cdr.detectChanges();
          },
        });
    } catch (error) {
      console.error('Password encryption failed:', error);

      this.isDeletingAccount = false;
      this.deleteAccountPassword = '';

      this.deleteAccountPasswordError = 'Unable to secure your password. Please try again.';

      this.cdr.detectChanges();
    }
  }
}

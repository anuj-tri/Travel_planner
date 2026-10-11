import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {

  // PROFILE DETAILS
  firstName: string = '';
  lastName: string = '';
  email: string = '';



  // PROFILE EDITING
  isEditing: boolean = false;
  originalFirstName: string = '';
  originalLastName: string = '';


  // PROFILE MESSAGES
  successMessage: string = '';

  firstNameError: string = '';
  lastNameError: string = '';

  // PROFILE LOADING / SAVING
  isLoading: boolean = true;
  isSaving: boolean = false;


  // CHANGE PASSWORD DETAILS
  currentPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';


  // CHANGE PASSWORD VALIDATION
  currentPasswordError: string = '';
  newPasswordError: string = '';
  confirmNewPasswordError: string = '';

  // CHANGE PASSWORD STATE
  isChangingPassword: boolean = false;
  passwordSuccessMessage: string = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}


  // COMPONENT INITIALIZATION
  ngOnInit(): void {
    this.getCurrentUser();
  }

  // CHECK PROFILE CHANGES
  get hasChanges(): boolean {
    return (
      this.firstName !== this.originalFirstName ||
      this.lastName !== this.originalLastName
    );
  }

  // GET CURRENT USER
  getCurrentUser(): void {
    const token = localStorage.getItem('access_token');

    if (!token) {
      console.log('Access token not found');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });


    this.http.get<any>(
      'http://127.0.0.1:8000/auth/me',
      { headers }
    ).subscribe({
      next: (response) => {
        console.log('Current user:', response);

        // Set profile details
        this.firstName = response.first_name;
        this.lastName = response.last_name;
        this.email = response.email;

        // Store original values
        this.originalFirstName = response.first_name;
        this.originalLastName = response.last_name;

        // Profile loading complete
        this.isLoading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error(
          'Failed to get current user:',
          error
        );
        this.isLoading = false;
        this.cdr.detectChanges();
      }
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


    // REMOVE EXTRA SPACES
    this.firstName = this.firstName.trim();
    this.lastName = this.lastName.trim();

    // VALIDATE FIRST NAME
    if (!this.firstName) {
      this.firstNameError ='Please fill in first name.';
    } else if (!/^[A-Za-z]+$/.test(this.firstName)){
      this.firstNameError = 'First name can contain alphabets only'
    }

    // VALIDATE LAST NAME
    if (!this.lastName) {
      this.lastNameError ='Please fill in last name.';
    } else if (!/^[A-Za-z]+$/.test(this.lastName)){
      this.lastNameError = 'Last name can contain alphabets only'
    }

    // STOP IF VALIDATION FAILED
    if (
      this.firstNameError ||this.lastNameError
    ) {
      return;
    }

    // CHECK WHETHER ANYTHING CHANGED
    if (!this.hasChanges) {
      this.isEditing = false;
      return;
    }

    // GET ACCESS TOKEN
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('Access token not found');
      return;
    }
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });


    // DATA SENT TO BACKEND
    const updatedProfile = {
      first_name: this.firstName,
      last_name: this.lastName

    };


    // PREVENT MULTIPLE SAVE CLICKS
    this.isSaving = true;


    // UPDATE PROFILE API
    this.http.patch<any>(
      'http://127.0.0.1:8000/auth/me',
      updatedProfile,
      { headers }
    ).subscribe({

      next: (response) => {

        console.log(
          'Profile updated successfully:',
          response
        );


        // Update displayed values
        this.firstName =response.first_name;
        this.lastName =response.last_name;

        // Update original values
        this.originalFirstName =response.first_name;
        this.originalLastName =response.last_name;


        // Exit editing mode
        this.isEditing = false;


        // Stop saving state
        this.isSaving = false;


        // Show success message
        this.successMessage =
          'Name changed successfully!';
        this.cdr.detectChanges();


        // Refresh page after 2 second
        setTimeout(() => {window.location.reload();
        }, 2000);

      },

      error: (error) => {
        console.error('Failed to update profile:', error);
        this.isSaving = false;
        this.cdr.detectChanges();

      }

    });

  }


  // CHANGE PASSWORD
  changePassword(): void {

    // CLEAR OLD ERRORS
    this.currentPasswordError = '';
    this.newPasswordError = '';
    this.confirmNewPasswordError = '';
    this.passwordSuccessMessage = '';


    // REMOVE EXTRA SPACES
    this.currentPassword = this.currentPassword.trim();
    this.newPassword = this.newPassword.trim();
    this.confirmNewPassword =this.confirmNewPassword.trim();

    // CURRENT PASSWORD VALIDATION
    if (!this.currentPassword) {
      this.currentPasswordError ='Please enter your current password.';
    }

    // NEW PASSWORD VALIDATION
    if (!this.newPassword) {
      this.newPasswordError ='Please enter a new password.';
    }

    // CONFIRM PASSWORD VALIDATION
    if (!this.confirmNewPassword) {
      this.confirmNewPasswordError = 'Please confirm your new password.';
    }

    //checking the new password is dirrent from current password.
    if (
      this.currentPassword && this.newPassword && this.currentPassword === this.newPassword
    ){
      this.newPasswordError = 'New password must be diffrent from your current password.';
    }

    // CHECK PASSWORD MATCH
    if (
      this.newPassword &&
      this.confirmNewPassword &&
      this.newPassword !== this.confirmNewPassword
    ) {

      this.confirmNewPasswordError ='New password and confirm password do not match.';
    }

    // STOP IF VALIDATION FAILED
    if (
      this.currentPasswordError || this.newPasswordError || this.confirmNewPasswordError
    ) {
      return;
    }

    //getting the access token

    const token = localStorage.getItem('access_token')

    if (!token) {
      console.log('Access token is not found');
      return;
    }

    //Authorization header

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    //request body

    const changePasswordData = {
      current_password: this.currentPassword,

      new_password: this.newPassword,

      confirm_new_password: this.confirmNewPassword
    };

    //prevent multiple clicks
    this.isChangingPassword = true;

    //now we put api
    this.http.patch<any>('http://127.0.0.1:8000/auth/me/change-password',changePasswordData,

    { headers }

  ).subscribe({

    // =======================================
    // SUCCESS
    // =======================================

    next: (response) => {

      console.log(
        'Password changed successfully:',
        response
      );

      // Stop loading state
      this.isChangingPassword = false;

      // Show success message
      this.passwordSuccessMessage ='Password changed successfully.';


      // Clear password fields
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';

      this.cdr.detectChanges();

      setTimeout(() => {
        window.location.reload();
      },1900);

    },

    // ERROR
    error: (error) => {
      console.error(
        'Failed to change password:',
        error
      );

      // Stop loading state
      this.isChangingPassword = false;

      //stop chaging password state.
      const errorMessage = error.error?.detail;

      //wrong current password

      if (
        errorMessage ==="Current password is incorrect" || errorMessage ==='Current password is incorrect.'
      ){
        this.currentPasswordError = 'Current password is incorrect.';

        this.cdr.detectChanges();
        return;
      }


      // New password confirmation mismatch
      if (
        errorMessage ===
        'New password and confirm password do not match.'
      ) {

        this.confirmNewPasswordError =
          'New password and confirm password do not match.';

          this.cdr.detectChanges();

        return;

      }

      // Generic error
      console.error(
        'Unexpected password change error:',
        errorMessage
      );

      this.cdr.detectChanges();
    }
  });
}
}
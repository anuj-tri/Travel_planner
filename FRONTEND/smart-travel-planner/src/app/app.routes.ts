import { Routes } from '@angular/router';


import { Login } from './auth/login/login';
import { Signup } from './auth/signup/signup';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { TripDashboard } from './trip-dashboard/trip-dashboard';
import { CreateNewTrip } from './trip-dashboard/create-new-trip/create-new-trip';
import { SavedTrips } from './trip-dashboard/saved-trips/saved-trips';
import { ModifyTrip } from './trip-dashboard/modify-trip/modify-trip';
import { Profile } from './trip-dashboard/profile/profile';
import { Itinerary } from './trip-dashboard/itinerary/itinerary';
import { ViewItinerary } from './trip-dashboard/view-itinerary/view-itinerary';



export const routes: Routes = [
    {
        path : ('login'),
        component: Login
    },
    {
        path: ('signup'),
        component: Signup
    },
    {
        path: ('forgot-password'),
        component:ForgotPassword
    },
    {
        path: ('reset-password'),
        component:ResetPassword
    },
    {
        path: ('trip-dashboard'),
        component: TripDashboard,
        children: [
            {
                path: 'create-new-trip',
                component: CreateNewTrip
            },
            {
                path: 'itinerary',
                component: Itinerary
            },
            {
                path: 'saved-trips',
                component: SavedTrips
            },
            {
                path: 'view-itinerary/:tripId',
                component: ViewItinerary
            },
            {
                path:'modify-trip',
                component: ModifyTrip
            },
            {
                path: 'profile',
                component: Profile
            }

        ]
    }
];

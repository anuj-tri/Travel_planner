import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditYourTrip } from './edit-your-trip';

describe('EditYourTrip', () => {
  let component: EditYourTrip;
  let fixture: ComponentFixture<EditYourTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditYourTrip],
    }).compileComponents();

    fixture = TestBed.createComponent(EditYourTrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

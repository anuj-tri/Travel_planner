import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateNewTrip } from './create-new-trip';

describe('CreateNewTrip', () => {
  let component: CreateNewTrip;
  let fixture: ComponentFixture<CreateNewTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateNewTrip],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateNewTrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

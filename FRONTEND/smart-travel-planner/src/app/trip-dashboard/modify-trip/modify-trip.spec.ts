import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModifyTrip } from './modify-trip';

describe('ModifyTrip', () => {
  let component: ModifyTrip;
  let fixture: ComponentFixture<ModifyTrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModifyTrip],
    }).compileComponents();

    fixture = TestBed.createComponent(ModifyTrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

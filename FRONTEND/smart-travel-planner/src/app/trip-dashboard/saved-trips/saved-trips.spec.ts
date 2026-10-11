import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedTrips } from './saved-trips';

describe('SavedTrips', () => {
  let component: SavedTrips;
  let fixture: ComponentFixture<SavedTrips>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedTrips],
    }).compileComponents();

    fixture = TestBed.createComponent(SavedTrips);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

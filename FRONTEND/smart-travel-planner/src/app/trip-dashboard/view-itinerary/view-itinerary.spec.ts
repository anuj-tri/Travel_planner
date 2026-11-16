import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewItinerary } from './view-itinerary';

describe('ViewItinerary', () => {
  let component: ViewItinerary;
  let fixture: ComponentFixture<ViewItinerary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewItinerary],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewItinerary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

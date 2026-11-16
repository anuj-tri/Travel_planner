import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditItinerary } from './edit-itinerary';

describe('EditItinerary', () => {
  let component: EditItinerary;
  let fixture: ComponentFixture<EditItinerary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditItinerary],
    }).compileComponents();

    fixture = TestBed.createComponent(EditItinerary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

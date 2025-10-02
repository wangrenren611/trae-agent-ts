/**
 * 旅游规划相关类型定义
 */

export interface TravelDestination {
  name: string;
  country: string;
  region?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
  bestSeasons?: string[];
  averageCost?: {
    budget: number;
    mid: number;
    luxury: number;
  };
}

export interface TravelAttraction {
  id: string;
  name: string;
  type: 'museum' | 'park' | 'landmark' | 'restaurant' | 'shopping' | 'entertainment' | 'nature' | 'historical' | 'cultural';
  description: string;
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  openingHours?: {
    [key: string]: string; // day: hours
  };
  ticketPrice?: {
    adult: number;
    child?: number;
    student?: number;
    currency: string;
  };
  rating?: number;
  reviews?: number;
  estimatedDuration: number; // minutes
  bestTimeToVisit?: string;
  tags?: string[];
}

export interface TravelAccommodation {
  id: string;
  name: string;
  type: 'hotel' | 'hostel' | 'apartment' | 'resort' | 'guesthouse' | 'camping';
  rating: number;
  pricePerNight: {
    budget: number;
    mid: number;
    luxury: number;
    currency: string;
  };
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy?: string;
}

export interface Transportation {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car_rental' | 'taxi' | 'metro' | 'walking';
  from: string;
  to: string;
  duration: number; // minutes
  cost: {
    amount: number;
    currency: string;
  };
  schedule?: {
    departure: string;
    arrival: string;
    frequency?: string;
  };
  provider?: string;
  bookingRequired: boolean;
}

export interface TravelDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  theme?: string;
  activities: TravelActivity[];
  totalEstimatedCost: number;
  currency: string;
  notes?: string;
}

export interface TravelActivity {
  id: string;
  time: string; // HH:MM
  duration: number; // minutes
  title: string;
  type: 'transportation' | 'attraction' | 'meal' | 'accommodation' | 'rest' | 'shopping' | 'entertainment';
  location: string;
  cost?: {
    amount: number;
    currency: string;
  };
  description: string;
  bookingRequired?: boolean;
  priority: 'high' | 'medium' | 'low';
  weatherDependent?: boolean;
  alternatives?: string[];
}

export interface TravelPlan {
  id: string;
  title: string;
  destination: TravelDestination;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  duration: number; // days
  travelers: {
    adults: number;
    children: number;
    infants: number;
  };
  budget: {
    total: number;
    currency: string;
    breakdown: {
      accommodation: number;
      transportation: number;
      food: number;
      activities: number;
      shopping: number;
      miscellaneous: number;
    };
  };
  preferences: {
    travelStyle: 'budget' | 'mid' | 'luxury';
    interests: string[];
    dietaryRestrictions: string[];
    mobilityRequirements: string[];
    language: string[];
  };
  itinerary: TravelDay[];
  accommodation?: TravelAccommodation;
  transportation: Transportation[];
  totalCost: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'confirmed' | 'active' | 'completed' | 'cancelled';
}

export interface TravelPlanningRequest {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: {
    adults: number;
    children: number;
    infants: number;
  };
  budget: {
    total: number;
    currency: string;
    breakdown?: {
      accommodation: number;
      transportation: number;
      food: number;
      activities: number;
      shopping: number;
      miscellaneous: number;
    };
  };
  preferences: {
    travelStyle: 'budget' | 'mid' | 'luxury';
    interests: string[];
    dietaryRestrictions: string[];
    mobilityRequirements: string[];
    language: string[];
  };
  specialRequirements?: string[];
}

export interface TravelBookingResult {
  success: boolean;
  bookingId?: string;
  confirmation?: string;
  totalCost?: number;
  currency?: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  error?: string;
}

export interface TravelPlanExecutionStatus {
  planId: string;
  currentDay: number;
  currentActivity?: string;
  completedActivities: string[];
  upcomingActivities: string[];
  totalSpent: number;
  remainingBudget: number;
  issues: string[];
  recommendations: string[];
}

// 旅游规划错误类型
export class TravelPlanningError extends Error {
  constructor(message: string, public readonly errorType: 'validation' | 'booking' | 'planning' | 'execution') {
    super(message);
    this.name = 'TravelPlanningError';
  }
}
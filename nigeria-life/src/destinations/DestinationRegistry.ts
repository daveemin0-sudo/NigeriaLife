import * as THREE from 'three';
import type { 
  DestinationDefinition, 
  TransportOption 
} from './DestinationTypes';

export class DestinationRegistry {
  private static instance: DestinationRegistry | null = null;
  private destinations: Map<string, DestinationDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  public static getInstance(): DestinationRegistry {
    if (!DestinationRegistry.instance) {
      DestinationRegistry.instance = new DestinationRegistry();
    }
    return DestinationRegistry.instance;
  }

  constructor() {
    this.registerStandardDestinations();
  }

  /**
   * Universal default 7-mode transport options with Lagos fares & realistic travel times.
   */
  public getDefaultTransportOptions(): TransportOption[] {
    return [
      {
        mode: 'walk',
        label: 'Walk on Foot',
        icon: '🚶',
        fare: 0,
        travelTimeSec: 12,
        description: 'Take a brisk walk across Lagos sidewalks. Free of charge.',
      },
      {
        mode: 'bike',
        label: 'Okada / Bike',
        icon: '🏍️',
        fare: 200,
        travelTimeSec: 6,
        description: 'Weave quickly through gridlock traffic. Fast & affordable.',
      },
      {
        mode: 'keke',
        label: 'Keke NAPEP',
        icon: '🛺',
        fare: 400,
        travelTimeSec: 5,
        description: 'Breezy commercial 3-wheeler. Reliable neighborhood transit.',
      },
      {
        mode: 'danfo',
        label: 'Yellow Danfo Bus',
        icon: '🚌',
        fare: 300,
        travelTimeSec: 7,
        description: 'Iconic yellow transporter with energetic Lagos conductor call-outs.',
      },
      {
        mode: 'brt',
        label: 'BRT Express Bus',
        icon: '🚍',
        fare: 500,
        travelTimeSec: 4,
        description: 'Air-conditioned dedicated lane transit with Cowry card boarding.',
      },
      {
        mode: 'taxi',
        label: 'Taxi / Bolt Cab',
        icon: '🚕',
        fare: 1500,
        travelTimeSec: 3,
        description: 'Chilled AC private cab ride directly to the destination entrance.',
      },
      {
        mode: 'car',
        label: 'Personal Car',
        icon: '🚗',
        fare: 0,
        travelTimeSec: 2,
        description: 'Drive your personal vehicle in comfort with zero fare.',
      },
    ];
  }

  private registerStandardDestinations(): void {
    const defaultTransports = this.getDefaultTransportOptions();

    // =========================================================================
    // 1. PROTOTYPE DESTINATION 1: HOSPITAL (St. Nicholas Lagos General Hospital)
    // =========================================================================
    this.register({
      id: 'dest_lagos_hospital',
      aliases: ['lagos-hospital', 'st_nicholas_hospital', 'hospital', 'general-hospital'],
      name: 'St. Nicholas Lagos General Hospital',
      category: 'Healthcare',
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Lagos Island',
      mapPosition: new THREE.Vector3(18, 0, 75),
      mapVisualType: 'hospital',
      mapIcon: '🏥',
      exteriorType: 'hospital_facade',
      streetPosition: new THREE.Vector3(12, 0, 75),
      entrance: {
        position: new THREE.Vector3(12, 0, 75),
        promptLabel: 'Enter St. Nicholas General Hospital',
        triggerRadius: 6.5,
      },
      interiorId: 'hospital',
      openingHours: 'Open 24/7',
      shortDescription: 'Triage, medical consultations, recovery beds & 24/7 pharmacy',
      destinationDescription:
        'Lagos Island premier state medical centre. Offers 24/7 emergency care, physician consultations, clinical recovery beds, and anti-malaria medications.',
      services: ['Doctor Consultation', 'Vital Signs Triage', 'Recovery Ward Beds', 'Pharmacy Dispensing'],
      transportAvailability: defaultTransports,
      npcPopulation: [
        {
          id: 'npc_dr_emeka',
          name: 'Dr. Emeka Okafor',
          role: 'Chief Medical Consultant',
          gender: 'male',
          attire: 'doctor_scrubs',
          dialogueGreeting: 'Welcome to St. Nicholas. Let us run your clinical vitals right away.',
          relativePosition: new THREE.Vector3(4, 0, 3),
        },
        {
          id: 'npc_nurse_blessing',
          name: 'Nurse Blessing',
          role: 'Triage Senior Officer',
          gender: 'female',
          attire: 'nurse_uniform',
          dialogueGreeting: 'Good day! Please register at the desk for blood pressure screening.',
          relativePosition: new THREE.Vector3(-3, 0, 2),
        },
      ],
      activities: [
        {
          id: 'hosp_reception',
          label: 'Register & Vital Signs Check',
          icon: '📋',
          description: 'Check blood pressure and register patient card.',
          cost: 500,
          rewardHealth: 20,
          dialogueResponse: 'Vitals verified: BP 120/80 mmHg, pulse normal.',
        },
        {
          id: 'hosp_doctor_desk',
          label: 'Full Medical Diagnosis & Treatment',
          icon: '🩺',
          description: 'Comprehensive physical examination with Dr. Adeleke.',
          cost: 2500,
          rewardHealth: 100,
          rewardEnergy: 50,
          dialogueResponse: 'Medical treatment administered. Health fully restored to 100%!',
        },
        {
          id: 'hosp_ward_bed',
          label: 'Rest on Clinical Ward Bed',
          icon: '🛏️',
          description: 'Rejuvenate under clinical saline infusion.',
          cost: 0,
          rewardHealth: 100,
          rewardEnergy: 100,
          dialogueResponse: 'You rested peacefully. 100% Health & Energy restored.',
        },
        {
          id: 'hosp_pharmacy',
          label: 'Buy Coartem Malaria Medicine',
          icon: '💊',
          description: 'Purchase original WHO-certified anti-malarial blister pack.',
          cost: 1800,
          itemReward: {
            id: 'coartem_med',
            name: 'Coartem Malaria Pack',
            category: 'medicine',
            price: 1800,
            icon: '💊',
            description: 'Fast-acting anti-malaria tablet.',
          },
          dialogueResponse: 'Dispensed 1 pack of Coartem tablets.',
        },
      ],
      isEnterable: true,
    });

    // =========================================================================
    // 2. PROTOTYPE DESTINATION 2: UNIVERSITY (University of Lagos / UNILAG)
    // =========================================================================
    this.register({
      id: 'dest_lagos_unilag',
      aliases: ['unilag', 'unilag-campus', 'university-lagos', 'yaba_unilag', 'dest_unilag'],
      name: 'University of Lagos (UNILAG)',
      category: 'University',
      city: 'lagos',
      district: 'yaba',
      districtName: 'Akoka, Yaba',
      mapPosition: new THREE.Vector3(-15, 0, -32),
      mapVisualType: 'university',
      mapIcon: '🏛️',
      exteriorType: 'university_gate',
      streetPosition: new THREE.Vector3(-15, 0, -32),
      entrance: {
        position: new THREE.Vector3(-15, 0, -32),
        promptLabel: 'Enter University of Lagos (UNILAG)',
        triggerRadius: 6.5,
      },
      interiorId: 'university',
      openingHours: '07:00 - 21:00',
      shortDescription: 'University of First Choice: Lecture halls, library, faculty campus & student quad',
      destinationDescription:
        'Premier Nigerian federal research university situated on the Akoka lagoon shore. Famous for rigorous academic programs, tech incubator minds, vibrant student life, and historic faculties.',
      services: ['Attend Academic Lectures', 'Library Research', 'Faculty Course Registration', 'Student Union Activities'],
      transportAvailability: defaultTransports,
      npcPopulation: [
        {
          id: 'npc_prof_balogun',
          name: 'Prof. Adebayo Balogun',
          role: 'Dean of Sciences & Engineering',
          gender: 'male',
          attire: 'lecturer_senator',
          dialogueGreeting: 'Great Akokite! Ensure you submit your term research paper on distributed systems before 4 PM.',
          relativePosition: new THREE.Vector3(0, 0, 5),
        },
        {
          id: 'npc_chidinma_student',
          name: 'Chidinma Nwosu',
          role: 'Computer Science Scholar',
          gender: 'female',
          attire: 'student_casual',
          dialogueGreeting: 'Hi! We are forming a study team for the upcoming Python & AI hackathon at CcHub.',
          relativePosition: new THREE.Vector3(-4, 0, 0),
        },
        {
          id: 'npc_femi_sug',
          name: 'Comrade Femi',
          role: 'Student Union Representative',
          gender: 'male',
          attire: 'student_casual',
          dialogueGreeting: 'Greatest Nigerian Students! University of first choice and the nation’s pride!',
          relativePosition: new THREE.Vector3(4, 0, 1),
        },
      ],
      activities: [
        {
          id: 'unilag_lecture_podium',
          label: 'Attend Faculty Lecture',
          icon: '🎓',
          description: 'Participate in a dynamic university lecture on software architecture and civic tech.',
          cost: 0,
          rewardKnowledge: 30,
          rewardEnergy: -10,
          dialogueResponse: 'You actively contributed to the lecture. Gained +30 Academic Knowledge!',
        },
        {
          id: 'unilag_library_desk',
          label: 'Research in Faculty Library',
          icon: '📚',
          description: 'Review research papers and study in quiet university carrels.',
          cost: 0,
          rewardKnowledge: 40,
          rewardEnergy: -15,
          dialogueResponse: 'You absorbed deep academic research. Gained +40 Knowledge!',
        },
        {
          id: 'unilag_admin_portal',
          label: 'Register Semester Courses',
          icon: '📝',
          description: 'Clear semester departmental registration and obtain academic docket.',
          cost: 1500,
          rewardKnowledge: 15,
          dialogueResponse: 'Semester registration validated! Docket printed successfully.',
        },
        {
          id: 'unilag_quad_gist',
          label: 'Socialize at Student Quad',
          icon: '💬',
          description: 'Relax with fellow students at the campus garden with roasted plantain & groundnut.',
          cost: 0,
          rewardSocial: 25,
          rewardEnergy: 20,
          dialogueResponse: 'Lively discussions recharged your spirits. +25 Social & +20 Energy!',
        },
      ],
      isEnterable: true,
    });

    // =========================================================================
    // 3. PROTOTYPE DESTINATION 3: AIRPORT (Murtala Muhammed International Airport)
    // =========================================================================
    this.register({
      id: 'dest_lagos_airport',
      aliases: ['airport_los', 'mma2', 'mma-airport', 'lagos-airport', 'airport', 'dest_airport'],
      name: 'Murtala Muhammed International Airport (LOS)',
      category: 'Airport',
      city: 'lagos',
      district: 'airport',
      districtName: 'Ikeja Aviation Corridor',
      mapPosition: new THREE.Vector3(-80, 0, -115),
      mapVisualType: 'airport',
      mapIcon: '✈️',
      exteriorType: 'airport_terminal',
      streetPosition: new THREE.Vector3(-80, 0, -105),
      entrance: {
        position: new THREE.Vector3(-80, 0, -105),
        promptLabel: 'Enter Murtala Muhammed Airport Terminal (LOS)',
        triggerRadius: 6.5,
      },
      interiorId: 'airport',
      openingHours: 'Open 24/7',
      shortDescription: 'Domestic & international departures, flight check-in, security & VIP lounge',
      destinationDescription:
        'West Africa’s busiest international air transport hub. Modern departure terminal, baggage screening, flight check-in, security screening, and direct flights to Abuja, Port Harcourt, and worldwide.',
      services: ['Flight Check-In', 'Baggage Security Screening', 'Interstate Flights', 'VIP Executive Lounge'],
      transportAvailability: defaultTransports,
      npcPopulation: [
        {
          id: 'npc_captain_ibrahim',
          name: 'Capt. Ibrahim Lawal',
          role: 'Senior Air Peace Captain',
          gender: 'male',
          attire: 'pilot_uniform',
          dialogueGreeting: 'Good afternoon. Pre-flight checks are green for our upcoming flight to Abuja.',
          relativePosition: new THREE.Vector3(3, 0, 4),
        },
        {
          id: 'npc_officer_ngozi',
          name: 'Officer Ngozi Adeleke',
          role: 'FAAN Security Commander',
          gender: 'female',
          attire: 'security_uniform',
          dialogueGreeting: 'Please have your government ID and boarding pass ready for security screening.',
          relativePosition: new THREE.Vector3(-3, 0, 1),
        },
        {
          id: 'npc_traveler_chuka',
          name: 'Chuka Emeka',
          role: 'International Business Traveler',
          gender: 'male',
          attire: 'traveler_suit',
          dialogueGreeting: 'Just landed from London Heathrow, connecting on the early hopper to Port Harcourt.',
          relativePosition: new THREE.Vector3(5, 0, -1),
        },
      ],
      activities: [
        {
          id: 'airport_checkin_desk',
          label: 'Terminal Flight Check-In',
          icon: '🎫',
          description: 'Check in luggage and print digital boarding pass for upcoming departure.',
          cost: 0,
          rewardSocial: 10,
          itemReward: {
            id: 'boarding_pass',
            name: 'Air Peace Boarding Pass',
            category: 'document',
            price: 0,
            icon: '🎫',
            description: 'Official verified boarding card.',
          },
          dialogueResponse: 'Baggage tagged and boarding pass issued for Gate 2.',
        },
        {
          id: 'airport_security_gate',
          label: 'Aviation Security Screening',
          icon: '🛡️',
          description: 'Pass through the FAA metal detector and hand-luggage X-ray scanner.',
          cost: 0,
          rewardKnowledge: 10,
          dialogueResponse: 'Security screening cleared. Proceed to Departure Lounge.',
        },
        {
          id: 'airport_flight_abuja',
          label: 'Board Flight to Abuja FCT',
          icon: '✈️',
          description: 'Fly direct to Nnamdi Azikiwe International Airport in Abuja.',
          cost: 35000,
          dialogueResponse: 'Flight boarded! Welcome to the Federal Capital Territory, Abuja.',
        },
        {
          id: 'airport_flight_ph',
          label: 'Board Flight to Port Harcourt',
          icon: '✈️',
          description: 'Fly direct to Port Harcourt International Airport (Omagwa).',
          cost: 38000,
          dialogueResponse: 'Flight boarded! Welcome to the Garden City, Port Harcourt.',
        },
        {
          id: 'airport_vip_lounge',
          label: 'Relax in Arik Executive Lounge',
          icon: '🥂',
          description: 'Enjoy plush armchairs, cold malt, coffee, and recharging amenities.',
          cost: 5000,
          rewardHealth: 100,
          rewardEnergy: 100,
          dialogueResponse: 'Relaxed in VIP lounge. Health & Energy fully refreshed!',
        },
      ],
      isEnterable: true,
    });

    // =========================================================================
    // ADDITIONAL CANONICAL DESTINATIONS (Existing or upcoming)
    // =========================================================================
    this.register({
      id: 'dest_lagos_bank',
      aliases: ['lagos-bank', 'broad_street_banks', 'bank', 'eko_bank'],
      name: 'Eko Commercial Bank & Wealth Hub',
      category: 'Bank',
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Broad Street, Lagos Island',
      mapPosition: new THREE.Vector3(0, 0, 0),
      mapVisualType: 'bank',
      mapIcon: '🏦',
      exteriorType: 'bank_facade',
      streetPosition: new THREE.Vector3(8.5, 0, -22),
      entrance: {
        position: new THREE.Vector3(8.5, 0, -22),
        promptLabel: 'Enter Eko Commercial Bank',
        triggerRadius: 6.5,
      },
      interiorId: 'bank',
      openingHours: '08:00 - 16:00',
      shortDescription: 'ATMs, foreign remittance wire pickups & business loans',
      destinationDescription: 'Historic financial thoroughfare on Broad Street hosting headquarters of top commercial banks.',
      services: ['ATM Cash Withdrawal', 'Foreign Wire Pickup', 'SME Business Loans'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_lagos_buka',
      aliases: ['mama-put', 'mama_put_buka', 'buka', 'chop-life'],
      name: 'Mama Put Buka & Chop Life Bar',
      category: 'Restaurant',
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Lagos Island',
      mapPosition: new THREE.Vector3(-12, 0, 18),
      mapVisualType: 'restaurant',
      mapIcon: '🍲',
      exteriorType: 'buka_facade',
      streetPosition: new THREE.Vector3(-17, 0, -10),
      entrance: {
        position: new THREE.Vector3(-17, 0, -10),
        promptLabel: 'Enter Mama Put Buka',
        triggerRadius: 6.5,
      },
      interiorId: 'restaurant',
      openingHours: '09:00 - 23:00',
      shortDescription: 'Firewood party jollof, goat meat, amala & chilled drinks',
      destinationDescription: 'Iconic street bukateria famous for sizzling Nigerian delicacies and lively music.',
      services: ['Order Food', 'Sit & Dine', 'Takeaway Packs'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_lagos_police',
      aliases: ['police-station', 'lagos_area_command_police', 'police', 'area_command_police'],
      name: 'Lagos Area Command Police Headquarters',
      category: 'Healthcare', // Public service
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Lagos Island',
      mapPosition: new THREE.Vector3(-25, 0, 65),
      mapVisualType: 'police',
      mapIcon: '👮',
      exteriorType: 'police_facade',
      streetPosition: new THREE.Vector3(-25, 0, 65),
      entrance: {
        position: new THREE.Vector3(-25, 0, 65),
        promptLabel: 'Enter Area Command Police Station',
        triggerRadius: 6.5,
      },
      interiorId: 'police',
      openingHours: 'Open 24/7',
      shortDescription: 'Citizen incident reporting, character clearance & bail bond desk',
      destinationDescription: 'Central area command station upholding peace and civil security in Lagos Island.',
      services: ['Incident Reports', 'Character Clearance', 'Bail Processing'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_lagos_residence',
      aliases: ['villa-compound', 'palm-view-flats', 'residence', 'home'],
      name: 'Victoria Residence Estate',
      category: 'Residential',
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Victoria Island',
      mapPosition: new THREE.Vector3(25, 0, 30),
      mapVisualType: 'residence',
      mapIcon: '🏠',
      exteriorType: 'residence_facade',
      streetPosition: new THREE.Vector3(25, 0, 30),
      entrance: {
        position: new THREE.Vector3(25, 0, 30),
        promptLabel: 'Enter Victoria Residence Apartment',
        triggerRadius: 6.5,
      },
      interiorId: 'residence',
      openingHours: 'Open 24/7',
      shortDescription: 'Furnished residential apartment with bedroom, kitchen & living room',
      destinationDescription: 'Comfortable private home with generator power, living room furniture, and full amenities.',
      services: ['Rest & Sleep', 'Decorate Home', 'Cook Food'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });
  }

  public register(dest: DestinationDefinition): void {
    this.destinations.set(dest.id, dest);
    this.aliasMap.set(dest.id, dest.id);
    for (const alias of dest.aliases) {
      this.aliasMap.set(alias.toLowerCase(), dest.id);
    }
  }

  public getById(idOrAlias: string): DestinationDefinition | null {
    if (!idOrAlias) return null;
    const clean = idOrAlias.toLowerCase();
    const canonId = this.aliasMap.get(clean) || this.aliasMap.get(idOrAlias);
    if (canonId) {
      return this.destinations.get(canonId) || null;
    }
    return this.destinations.get(idOrAlias) || null;
  }

  public getAll(): DestinationDefinition[] {
    return Array.from(this.destinations.values());
  }

  public getAllForCity(cityId: string): DestinationDefinition[] {
    const cleanCity = cityId.toLowerCase();
    return this.getAll().filter((d) => d.city === cleanCity || (cleanCity.includes('lagos') && d.city === 'lagos'));
  }

  /**
   * Check if an object ID or building matches any enterable destination.
   */
  public findDestinationByPosition(pos: THREE.Vector3, maxRadius: number = 7.0): DestinationDefinition | null {
    for (const dest of this.destinations.values()) {
      if (dest.entrance.position.distanceTo(pos) <= maxRadius) {
        return dest;
      }
    }
    return null;
  }
}

import * as THREE from 'three';
import type { 
  DestinationDefinition, 
  TransportOption 
} from './DestinationTypes';
import { PLACE_HOURS, describeHours } from './Hours';
import { getLagosBenchmarkDestinations } from './data/LagosBenchmarkPlaces';
import { getAbujaBenchmarkDestinations } from './data/AbujaBenchmarkPlaces';
import { getPortHarcourtBenchmarkDestinations } from './data/PortHarcourtBenchmarkPlaces';

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
        fare: 800,
        travelTimeSec: 6,
        description: 'Weave quickly through gridlock traffic. Fast & affordable.',
      },
      {
        mode: 'keke',
        label: 'Keke NAPEP',
        icon: '🛺',
        fare: 500,
        travelTimeSec: 5,
        description: 'Breezy commercial 3-wheeler. Reliable neighborhood transit.',
      },
      {
        mode: 'danfo',
        label: 'Yellow Danfo Bus',
        icon: '🚌',
        fare: 500,
        travelTimeSec: 7,
        description: 'Iconic yellow transporter with energetic Lagos conductor call-outs.',
      },
      {
        mode: 'brt',
        label: 'BRT Express Bus',
        icon: '🚍',
        fare: 600,
        travelTimeSec: 4,
        description: 'Air-conditioned dedicated lane transit with Cowry card boarding.',
      },
      {
        mode: 'taxi',
        label: 'Taxi / Bolt Cab',
        icon: '🚕',
        fare: 4500,
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
      streetPosition: new THREE.Vector3(8.8, 0, 75),
      entrance: {
        position: new THREE.Vector3(8.8, 0, 75),
        promptLabel: 'Enter St. Nicholas General Hospital',
        triggerRadius: 6.5,
      },
      interiorId: 'hospital',
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
      hours: PLACE_HOURS.university,
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
      mapPosition: new THREE.Vector3(-63, 0, 6255),
      mapVisualType: 'airport',
      mapIcon: '✈️',
      exteriorType: 'airport_terminal',
      streetPosition: new THREE.Vector3(-53, 0, 6268.8),
      entrance: {
        position: new THREE.Vector3(-53, 0, 6268.8),
        promptLabel: 'Enter Murtala Muhammed Airport Terminal (LOS)',
        triggerRadius: 6.5,
      },
      interiorId: 'airport',
      shortDescription: 'Domestic & international departures, flight check-in, security & VIP lounge',
      destinationDescription:
        'West Africa’s busiest international air transport hub. Modern departure terminal, baggage screening, flight check-in, security screening, and direct flights to Abuja, Port Harcourt, and worldwide.',
      services: ['Flight Check-In', 'Baggage Security Screening', 'Interstate Flights', 'VIP Executive Lounge', 'Baggage Claim Reclaim'],
      transportAvailability: defaultTransports,
      npcPopulation: [
        {
          id: 'npc_captain_ibrahim',
          name: 'Capt. Ibrahim Lawal',
          role: 'Senior Wazobia Air Captain',
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
            name: 'Wazobia Air Boarding Pass',
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
          cost: 4_200_000,
          dialogueResponse: 'Flight boarded! Welcome to the Federal Capital Territory, Abuja.',
        },
        {
          id: 'airport_flight_ph',
          label: 'Board Flight to Port Harcourt',
          icon: '✈️',
          description: 'Fly direct to Port Harcourt International Airport (Omagwa).',
          cost: 3_600_000,
          dialogueResponse: 'Flight boarded! Welcome to the Garden City, Port Harcourt.',
        },
        {
          id: 'airport_vip_lounge',
          label: 'Relax in NigeriaLife Air Executive Lounge',
          icon: '🥂',
          description: 'Enjoy plush armchairs, cold malt, coffee, and recharging amenities.',
          cost: 40000,
          rewardHealth: 100,
          rewardEnergy: 100,
          dialogueResponse: 'Relaxed in VIP lounge. Health & Energy fully refreshed!',
        },
        {
          id: 'airport_baggage_carousel',
          label: 'Claim Checked Travel Luggage',
          icon: '🧳',
          description: 'Collect your tagged travel bags from Carousel 1 before heading to the street.',
          cost: 0,
          rewardSocial: 15,
          dialogueResponse: 'Luggage collected from Carousel 1! Personal items verified. Street curbside doors are right ahead.',
        },
      ],
      isEnterable: true,
    });

    // =========================================================================
    // THE GREAT PLACES: built in the open city, with nothing to go inside (see world/landmarks)
    // =========================================================================
    this.register({
      id: 'dest_lagos_stadium',
      aliases: ['surulere-stadium', 'national_stadium', 'stadium'],
      name: 'National Stadium, Surulere',
      category: 'Stadium',
      city: 'lagos',
      district: 'surulere',
      districtName: 'Stadium Road, Surulere',
      mapPosition: new THREE.Vector3(-74, 0, 15),
      mapVisualType: 'stadium',
      mapIcon: '🏟️',
      exteriorType: 'stadium',
      streetPosition: new THREE.Vector3(-44.1, 0, 5),
      entrance: {
        position: new THREE.Vector3(-44.1, 0, 5),
        promptLabel: 'Gate A of the National Stadium',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: PLACE_HOURS.stadium,
      shortDescription: 'Football through the day. Tickets at the booth by Gate A.',
      destinationDescription: 'A pitch and running track with stands on all four sides. Buy a ticket at the booth, go in through Gate A and watch the match from the foot of the east stand.',
      services: ['Match tickets', 'Seats at the pitch side'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_lagos_port',
      aliases: ['apapa-port', 'apapa_port', 'port'],
      name: 'Apapa Port',
      category: 'Seaport',
      city: 'lagos',
      district: 'port_apapa',
      districtName: 'Wharf Road, Apapa',
      mapPosition: new THREE.Vector3(-87.5, 0, 76),
      mapVisualType: 'port',
      mapIcon: '⚓',
      exteriorType: 'container_port',
      streetPosition: new THREE.Vector3(-43.4, 0, 48),
      entrance: {
        position: new THREE.Vector3(-43.4, 0, 48),
        promptLabel: 'Gate 1 of Apapa Port',
        triggerRadius: 6.5,
      },
      interiorId: '',
      shortDescription: 'Container terminal. Paid work at the loading bay inside the gate.',
      destinationDescription: 'A quay with a cargo ship alongside, gantry cranes, a container yard, a shed and the terminal office. Lorries are loaded by hand at the bay just inside the gate.',
      services: ['Loading work, paid by the lorry'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_lagos_quilox',
      aliases: ['quilox-club', 'quilox_vi', 'quilox', 'club'],
      name: 'Quilox Nightclub',
      category: 'Nightclub',
      city: 'lagos',
      district: 'victoria_island',
      districtName: 'Victoria Island',
      mapPosition: new THREE.Vector3(24, 0, 103),
      mapVisualType: 'club',
      mapIcon: '🎶',
      exteriorType: 'nightclub',
      streetPosition: new THREE.Vector3(14.8, 0, 103),
      entrance: {
        position: new THREE.Vector3(14.8, 0, 103),
        promptLabel: 'Go in to Quilox',
        triggerRadius: 6.5,
      },
      interiorId: 'club',
      hours: PLACE_HOURS.club,
      shortDescription: 'Dance floor, DJ, bar and lounge. Gate fee at the desk inside.',
      destinationDescription: 'A nightclub on Victoria Island. Pay the gate fee at the desk, then the bar, the dance floor and (with a bottle) the lounge are yours until closing. Shut through the day.',
      services: ['Gate fee, once a night', 'Drinks at the bar', 'Dance floor', 'Lounge tables with a bottle'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
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
      hours: PLACE_HOURS.bank,
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
      hours: PLACE_HOURS.buka,
      shortDescription: 'Firewood party jollof, goat meat, amala & chilled drinks',
      destinationDescription: 'Iconic street bukateria famous for sizzling Nigerian delicacies and lively music.',
      services: ['Order Food', 'Sit & Dine', 'Takeaway Packs'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_lagos_supermarket',
      aliases: ['supermarket', 'everyday_supermarket', 'everyday-supermarket'],
      name: 'Everyday Supermarket',
      category: 'Supermarket',
      city: 'lagos',
      district: 'lagos_island',
      districtName: 'Lagos Island',
      mapPosition: new THREE.Vector3(14, 0, 36),
      mapVisualType: 'shop',
      mapIcon: '🛒',
      exteriorType: 'shop_facade',
      streetPosition: new THREE.Vector3(10.9, 0, -45),
      entrance: {
        position: new THREE.Vector3(10.9, 0, -45),
        promptLabel: 'Enter Everyday Supermarket',
        triggerRadius: 6.5,
      },
      interiorId: 'shop',
      hours: PLACE_HOURS.supermarket,
      shortDescription: 'Cold drinks, bread, noodles, snacks and household things',
      destinationDescription: 'A neighbourhood supermarket. Take a basket, pick from the shelves and pay at the till.',
      services: ['Groceries', 'Cold Drinks', 'Household & Gadgets'],
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
      streetPosition: new THREE.Vector3(-15.4, 0, 65),
      entrance: {
        position: new THREE.Vector3(-15.4, 0, 65),
        promptLabel: 'Enter Area Command Police Station',
        triggerRadius: 6.5,
      },
      interiorId: 'police',
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
      shortDescription: 'Furnished residential apartment with bedroom, kitchen & living room',
      destinationDescription: 'Comfortable private home with generator power, living room furniture, and full amenities.',
      services: ['Rest & Sleep', 'Decorate Home', 'Cook Food'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    // =========================================================================
    // LAGOS CANONICAL TRANSIT & CULTURE HUBS
    // =========================================================================
    this.register({
      id: 'dest_lagos_jibowu',
      aliases: ['jibowu_motor_park', 'jibowu-park', 'jibowu-park-tickets', 'jibowu-park-coach', 'jibowu'],
      name: 'Jibowu Motor Park',
      category: 'Transit',
      city: 'lagos',
      district: 'mainland',
      districtName: 'Ikorodu Road Corridor, Mainland',
      mapPosition: new THREE.Vector3(92.5, 0, -85),
      mapVisualType: 'transit',
      mapIcon: '🚌',
      exteriorType: 'motor_park',
      streetPosition: new THREE.Vector3(92.5, 0, -69.6),
      entrance: {
        position: new THREE.Vector3(92.5, 0, -69.6),
        promptLabel: 'Enter Jibowu Motor Park',
        triggerRadius: 6.5,
      },
      interiorId: '',
      shortDescription: 'Interstate coaches to Abuja and Port Harcourt. Tickets at the window by the gate.',
      destinationDescription:
        'Major mainland transport hub where interstate coaches depart for the Federal Capital Territory and the Niger Delta. Buy tickets at the window and board the coach.',
      services: ['Interstate Coach to Abuja', 'Interstate Coach to Port Harcourt', 'Luggage & Freight Handling'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_lagos_nike_art',
      aliases: ['nike_art_gallery', 'nike-art-gallery', 'nike_gallery'],
      name: 'Nike Art Gallery & Cultural Studio',
      category: 'Culture',
      city: 'lagos',
      district: 'lekki',
      districtName: 'Lekki Phase 1',
      mapPosition: new THREE.Vector3(75, 0, 15),
      mapVisualType: 'culture',
      mapIcon: '🎨',
      exteriorType: 'art_gallery',
      streetPosition: new THREE.Vector3(75.6, 0, -8),
      entrance: {
        position: new THREE.Vector3(75.6, 0, -8),
        promptLabel: 'Enter Nike Art Gallery',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 9, closes: 19 },
      shortDescription: 'Five storeys of masterpiece African art, bronze sculptures, and Adire textiles.',
      destinationDescription:
        'Africa’s largest private art gallery displaying over 8,000 Nigerian paintings, bronze sculptures, and traditional Adire and Oshogbo tie-dye fabrics.',
      services: ['African Masterpiece Collection', 'Adire Textile Workshops', 'Art Acquisition & Cultural Tours'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_lagos_cchub',
      aliases: ['cchub_yaba', 'cchub', 'co-creation-hub'],
      name: 'Co-Creation Hub (CcHub Yaba)',
      category: 'Civic',
      city: 'lagos',
      district: 'yaba',
      districtName: 'Herbert Macaulay Way, Yaba',
      mapPosition: new THREE.Vector3(-10, 0, -25),
      mapVisualType: 'tech',
      mapIcon: '💡',
      exteriorType: 'tech_hub',
      streetPosition: new THREE.Vector3(-10, 0, -25),
      entrance: {
        position: new THREE.Vector3(-10, 0, -25),
        promptLabel: 'Enter CcHub Innovation Centre',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 8, closes: 20 },
      shortDescription: 'Historic cradle of Nigerian tech startups, incubation labs, and developer events.',
      destinationDescription:
        'Pioneering social innovation centre and startup incubator on the Yaba tech strip. Fosters tech founders, civic technology, and software development.',
      services: ['Co-working Desks', 'Startup Mentorship', 'Developer Workshops'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_lagos_computer_village',
      aliases: ['computer_village', 'otigba_computer_village', 'otigba'],
      name: 'Computer Village (Otigba Technology Market)',
      category: 'Market',
      city: 'lagos',
      district: 'ikeja',
      districtName: 'Otigba Street, Ikeja',
      mapPosition: new THREE.Vector3(-15, 0, -95),
      mapVisualType: 'tech',
      mapIcon: '💻',
      exteriorType: 'market_facade',
      streetPosition: new THREE.Vector3(-15, 0, -95),
      entrance: {
        position: new THREE.Vector3(-15, 0, -95),
        promptLabel: 'Enter Computer Village',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 8, closes: 19 },
      shortDescription: 'West Africa’s largest ICT, phone repair, hardware and electronics marketplace.',
      destinationDescription:
        'High-octane electronics trading epicentre where thousands of engineers, phone technicians, and hardware distributors buy and sell daily.',
      services: ['Phone & Laptop Repair', 'Gadget Accessories', 'Hardware Wholesale'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    // =========================================================================
    // ABUJA CANONICAL DESTINATIONS (Federal Capital Territory)
    // =========================================================================
    this.register({
      id: 'dest_abuja_airport',
      aliases: ['abuja_airport', 'nnamdi_azikiwe_airport', 'abv_airport'],
      name: 'Nnamdi Azikiwe International Airport (ABV)',
      category: 'Airport',
      city: 'abuja',
      district: 'airport_abuja',
      districtName: 'Airport Road, Abuja',
      mapPosition: new THREE.Vector3(0, 0, 115),
      mapVisualType: 'airport',
      mapIcon: '✈️',
      exteriorType: 'airport_terminal',
      streetPosition: new THREE.Vector3(0, 0, 115),
      entrance: {
        position: new THREE.Vector3(0, 0, 115),
        promptLabel: 'Enter Nnamdi Azikiwe International Airport Terminal',
        triggerRadius: 6.5,
      },
      interiorId: 'airport',
      shortDescription: 'Federal Capital aviation gateway with domestic flights to Lagos and Port Harcourt.',
      destinationDescription:
        'Modern international airport serving the Federal Capital Territory with direct jet links across Nigeria and worldwide.',
      services: ['Domestic Flight Check-In', 'Baggage Screening', 'Flights to Lagos & Port Harcourt', 'VIP Executive Lounge'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_abuja_bank',
      aliases: ['savanna_bank_abuja', 'savanna_bank', 'savanna-bank'],
      name: 'Savanna Bank',
      category: 'Bank',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Shehu Shagari Way, Central Business District',
      mapPosition: new THREE.Vector3(17, 0, -8.6),
      mapVisualType: 'bank',
      mapIcon: '🏧',
      exteriorType: 'bank_facade',
      streetPosition: new THREE.Vector3(17, 0, -8.6),
      entrance: {
        position: new THREE.Vector3(17, 0, -8.6),
        promptLabel: 'Use Savanna Bank ATM',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: PLACE_HOURS.bank,
      shortDescription: 'The bank on Shehu Shagari Way. The cash machine in its wall works at any hour.',
      destinationDescription:
        'Commercial banking branch on Shehu Shagari Way providing counter services by day and a 24/7 ATM in the exterior wall.',
      services: ['24/7 ATM Cash Withdrawal', 'Treasury & Corporate Accounts', 'Foreign Exchange'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_secretariat',
      aliases: ['federal_secretariat', 'federal-secretariat', 'secretariat'],
      name: 'Federal Secretariat Complex',
      category: 'Civic',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Shehu Shagari Way, Central Business District',
      mapPosition: new THREE.Vector3(-24, 0, 32),
      mapVisualType: 'commercial',
      mapIcon: '🏛️',
      exteriorType: 'government_complex',
      streetPosition: new THREE.Vector3(-14, 0, 32),
      entrance: {
        position: new THREE.Vector3(-14, 0, 32),
        promptLabel: 'Enter Federal Secretariat Complex',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 8, closes: 17 },
      shortDescription: 'The ministries of the Federation, on the west side of Shehu Shagari Way.',
      destinationDescription:
        'Central bureaucratic complex of Nigeria housing Federal Ministries, civil servant offices, and administrative departments.',
      services: ['Civil Service Inquiries', 'Government Gazette & Filings', 'Ministerial Public Affairs'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_utako',
      aliases: ['utako_motor_park', 'utako-park', 'utako-park-tickets', 'utako-park-coach', 'utako'],
      name: 'Utako Motor Park',
      category: 'Transit',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Central Business District, Abuja',
      mapPosition: new THREE.Vector3(30, 0, 35),
      mapVisualType: 'transit',
      mapIcon: '🚌',
      exteriorType: 'motor_park',
      streetPosition: new THREE.Vector3(30, 0, 35),
      entrance: {
        position: new THREE.Vector3(30, 0, 35),
        promptLabel: 'Enter Utako Motor Park',
        triggerRadius: 6.5,
      },
      interiorId: '',
      shortDescription: 'Where coaches to Lagos and Port Harcourt leave from and pull in. Tickets at the window by the gate.',
      destinationDescription:
        'Primary interstate coach departure point for travelers crossing the Federation to the South-West and Niger Delta.',
      services: ['Interstate Coach to Lagos', 'Interstate Coach to Port Harcourt', 'Luggage Handling'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_cabs',
      aliases: ['abuja_cab_rank', 'federal_green_cab_rank', 'green_cabs'],
      name: 'Federal Green Cab Rank',
      category: 'Transit',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Shehu Shagari Way, Central Business District',
      mapPosition: new THREE.Vector3(14, 0, 12),
      mapVisualType: 'transit',
      mapIcon: '🚕',
      exteriorType: 'cab_rank',
      streetPosition: new THREE.Vector3(14, 0, 12),
      entrance: {
        position: new THREE.Vector3(14, 0, 12),
        promptLabel: 'Hail Green Cab',
        triggerRadius: 6.5,
      },
      interiorId: '',
      shortDescription: 'The cab rank on the east side of Shehu Shagari Way with green and white city cabs.',
      destinationDescription:
        'Official FCT licensed green cab station providing prompt point-to-point transit across Garki, Wuse, Maitama, and Asokoro.',
      services: ['City Cab Hire', 'Airport Express Drop-off', 'Intra-FCT Charter'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_aso_rock',
      aliases: ['aso_rock', 'aso-rock', 'three_arms_zone'],
      name: 'Aso Rock & Three Arms Monolith',
      category: 'Civic',
      city: 'abuja',
      district: 'asokoro',
      districtName: 'Three Arms Zone, Asokoro',
      mapPosition: new THREE.Vector3(85, 0, 50),
      mapVisualType: 'landmark',
      mapIcon: '⛰️',
      exteriorType: 'rock_monolith',
      streetPosition: new THREE.Vector3(85, 0, 50),
      entrance: {
        position: new THREE.Vector3(85, 0, 50),
        promptLabel: 'Inspect Aso Rock Monolith',
        triggerRadius: 10.0,
      },
      interiorId: '',
      shortDescription: '400m natural granite monolith dominating the capital skyline and Federal seat of power.',
      destinationDescription:
        'The geological emblem of Nigeria. Rises 400 metres above sea level directly overlooking the Presidential Villa and Supreme Court.',
      services: ['Scenic Monument Vista', 'Geological Heritage Site'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_mosque',
      aliases: ['national_mosque', 'abuja_national_mosque', 'national-mosque'],
      name: 'Abuja National Mosque',
      category: 'Church',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Independence Avenue, Central Business District',
      mapPosition: new THREE.Vector3(0, 0, -10),
      mapVisualType: 'culture',
      mapIcon: '🕌',
      exteriorType: 'mosque',
      streetPosition: new THREE.Vector3(0, 0, -10),
      entrance: {
        position: new THREE.Vector3(0, 0, -10),
        promptLabel: 'Enter Abuja National Mosque',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 5, closes: 22 },
      shortDescription: 'Stunning national landmark with pure gold dome and four 120m minarets.',
      destinationDescription:
        'National sanctuary of Islamic worship and architectural splendour. Features an expansive golden dome, polished marble courtyards, and library.',
      services: ['Daily Prayers', 'Cultural Architectural Visits', 'Islamic Library'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_abuja_ecumenical',
      aliases: ['ecumenical_centre', 'national_christian_centre', 'national-christian-centre'],
      name: 'National Christian Centre (Ecumenical)',
      category: 'Church',
      city: 'abuja',
      district: 'cbd_abuja',
      districtName: 'Central Business District, Abuja',
      mapPosition: new THREE.Vector3(8, 0, 16),
      mapVisualType: 'culture',
      mapIcon: '⛪',
      exteriorType: 'cathedral',
      streetPosition: new THREE.Vector3(8, 0, 16),
      entrance: {
        position: new THREE.Vector3(8, 0, 16),
        promptLabel: 'Enter National Christian Centre',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: { opens: 6, closes: 21 },
      shortDescription: 'Soaring neo-Gothic spire, bell tower, and national Christian cathedral sanctuary.',
      destinationDescription:
        'Masterpiece cathedral constructed with pivoting neo-gothic arches, stained glass panes, pipe organ, and soaring copper-clad spire.',
      services: ['Cathedral Sanctuary', 'Choral Performance', 'Ecumenical Fellowship'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    // =========================================================================
    // PORT HARCOURT CANONICAL DESTINATIONS (Garden City & Oil Hub)
    // =========================================================================
    this.register({
      id: 'dest_ph_airport',
      aliases: ['ph_airport_omagwa', 'ph_airport', 'omagwa_airport', 'phc_airport'],
      name: 'Port Harcourt International Airport (PHC Omagwa)',
      category: 'Airport',
      city: 'port_harcourt',
      district: 'airport_ph',
      districtName: 'Omagwa Aviation Corridor, Port Harcourt',
      mapPosition: new THREE.Vector3(0, 0, -95),
      mapVisualType: 'airport',
      mapIcon: '✈️',
      exteriorType: 'airport_terminal',
      streetPosition: new THREE.Vector3(0, 0, -95),
      entrance: {
        position: new THREE.Vector3(0, 0, -95),
        promptLabel: 'Enter Port Harcourt Airport Terminal (Omagwa)',
        triggerRadius: 6.5,
      },
      interiorId: 'airport',
      shortDescription: 'Primary international aviation hub serving the South-South with express flights to Lagos and Abuja.',
      destinationDescription:
        'Modern aviation hub connecting the Garden City and oil & gas corridor to Lagos, Abuja, and international air routes.',
      services: ['Flight Check-In', 'Baggage Security Screening', 'Flights to Lagos & Abuja', 'Executive Lounge'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_ph_bank',
      aliases: ['delta_bank_ph', 'delta_bank', 'delta-bank'],
      name: 'Delta Bank',
      category: 'Bank',
      city: 'port_harcourt',
      district: 'd_line',
      districtName: 'Aba Road, D-Line',
      mapPosition: new THREE.Vector3(17, 0, -22.4),
      mapVisualType: 'bank',
      mapIcon: '🏧',
      exteriorType: 'bank_facade',
      streetPosition: new THREE.Vector3(17, 0, -22.4),
      entrance: {
        position: new THREE.Vector3(17, 0, -22.4),
        promptLabel: 'Use Delta Bank ATM',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: PLACE_HOURS.bank,
      shortDescription: 'The bank on Aba Road. The cash machine in its wall works at any hour.',
      destinationDescription:
        'Regional commercial bank branch on Aba Road. Daytime teller counters and a 24/7 ATM embedded in the perimeter wall.',
      services: ['24/7 ATM Cash Withdrawal', 'Business Accounts', 'Foreign Remittance'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_ph_waterlines',
      aliases: ['waterlines_motor_park', 'waterlines-park', 'waterlines-park-tickets', 'waterlines-park-coach', 'waterlines'],
      name: 'Waterlines Motor Park',
      category: 'Transit',
      city: 'port_harcourt',
      district: 'd_line',
      districtName: 'Aba Road, D-Line',
      mapPosition: new THREE.Vector3(30, 0, 38),
      mapVisualType: 'transit',
      mapIcon: '🚌',
      exteriorType: 'motor_park',
      streetPosition: new THREE.Vector3(30, 0, 38),
      entrance: {
        position: new THREE.Vector3(30, 0, 38),
        promptLabel: 'Enter Waterlines Motor Park',
        triggerRadius: 6.5,
      },
      interiorId: '',
      shortDescription: 'Where coaches to Lagos and Abuja leave from and pull in. Tickets at the window by the gate.',
      destinationDescription:
        'Historic long-distance coach terminal at Waterlines Junction on Aba Road connecting the Garden City to Lagos and Abuja.',
      services: ['Interstate Coach to Lagos', 'Interstate Coach to Abuja', 'Cargo & Package Delivery'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_ph_bole',
      aliases: ['bole_king_ph', 'ph-bole-king', 'ph_bole_king', 'bole_king'],
      name: 'Famous Port Harcourt Bole & Fish Spot',
      category: 'Restaurant',
      city: 'port_harcourt',
      district: 'd_line',
      districtName: 'D-Line, Port Harcourt',
      mapPosition: new THREE.Vector3(-15, 0, 10),
      mapVisualType: 'restaurant',
      mapIcon: '🐟',
      exteriorType: 'buka_facade',
      streetPosition: new THREE.Vector3(-15, 0, 10),
      entrance: {
        position: new THREE.Vector3(-15, 0, 10),
        promptLabel: 'Enter Port Harcourt Bole King',
        triggerRadius: 6.5,
      },
      interiorId: 'restaurant',
      hours: PLACE_HOURS.buka,
      shortDescription: 'Authentic roasted plantain, spicy pepper sauce, smoked fish & chilled palm wine.',
      destinationDescription:
        'The culinary pride of Rivers State. Charcoal roasted plantains, seasoned grilled mackerel fish, and signature spicy pepper sauce.',
      services: ['Order Roasted Bole & Fish', 'Spicy Pepper Sauce Extra', 'Chilled Drinks & Palm Wine'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: true,
    });

    this.register({
      id: 'dest_ph_refinery',
      aliases: ['ph_refinery_hub', 'ph-refinery', 'refinery_hub'],
      name: 'Port Harcourt Petroleum Refinery & Tank Farms',
      category: 'Refinery',
      city: 'port_harcourt',
      district: 'trans_amadi',
      districtName: 'Trans-Amadi Industrial Layout',
      mapPosition: new THREE.Vector3(55, 0, -10),
      mapVisualType: 'port',
      mapIcon: '🛢️',
      exteriorType: 'refinery_complex',
      streetPosition: new THREE.Vector3(30, 0, -35),
      entrance: {
        position: new THREE.Vector3(30, 0, -35),
        promptLabel: 'Port Harcourt Refinery Gates',
        triggerRadius: 8.0,
      },
      interiorId: '',
      hours: { opens: 7, closes: 18 },
      shortDescription: 'Refining towers, massive storage tanks, pipelines, and fuel tanker logistics.',
      destinationDescription:
        'Major national oil refining infrastructure in Trans-Amadi featuring industrial distillation columns, petroleum storage tanks, and heavy tanker loading.',
      services: ['Petroleum Distribution Logistics', 'Fuel Tanker Loading', 'Facility Oversight'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    this.register({
      id: 'dest_ph_uniport',
      aliases: ['uniport_campus', 'uniport', 'uniport-campus'],
      name: 'University of Port Harcourt (UNIPORT)',
      category: 'University',
      city: 'port_harcourt',
      district: 'choba_uniport',
      districtName: 'Choba Boulevard, Port Harcourt',
      mapPosition: new THREE.Vector3(-80, 0, -55),
      mapVisualType: 'tech',
      mapIcon: '🎓',
      exteriorType: 'university_gate',
      streetPosition: new THREE.Vector3(-80, 0, -55),
      entrance: {
        position: new THREE.Vector3(-80, 0, -55),
        promptLabel: 'Enter UNIPORT Delta Campus Gate',
        triggerRadius: 6.5,
      },
      interiorId: '',
      hours: PLACE_HOURS.university,
      shortDescription: 'Delta Park campus, faculty of engineering, library, and student quad.',
      destinationDescription:
        'Premier federal institution in the Niger Delta celebrated for petroleum engineering, theater arts, and medical sciences.',
      services: ['Engineering Lecture Theatres', 'Faculty Library', 'Student Quadrangle'],
      transportAvailability: defaultTransports,
      npcPopulation: [],
      activities: [],
      isEnterable: false,
    });

    // =========================================================================
    // BENCHMARK EXPANSIONS (Full 125 Places: 24 Lagos, 69 Abuja, 32 PH)
    // =========================================================================
    for (const place of getLagosBenchmarkDestinations(defaultTransports)) {
      this.register(place);
    }
    for (const place of getAbujaBenchmarkDestinations(defaultTransports)) {
      this.register(place);
    }
    for (const place of getPortHarcourtBenchmarkDestinations(defaultTransports)) {
      this.register(place);
    }
  }

  /** A place goes on the record. What its card says about its hours is written from the hours themselves. */
  public register(place: Omit<DestinationDefinition, 'openingHours'>): void {
    const dest: DestinationDefinition = { ...place, openingHours: describeHours(place.hours) };
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

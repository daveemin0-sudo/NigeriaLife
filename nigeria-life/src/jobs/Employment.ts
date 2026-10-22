import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import type { PlayerSkills } from '../backend/types';

/**
 * Being employed somewhere: taken on at a real workplace, doing its work there, paid for each
 * piece of work at the rate of the grade reached, and moving up a grade as the work adds up.
 *
 * The work itself is done in the world (crates carried at the port, say). This is the record
 * of it: who the player works for, how much they have done, and what that is worth.
 */

export interface Grade {
  title: string;
  /** Paid for each piece of work at this grade */
  pay: number;
  /** Pieces of work done before this grade is reached */
  from: number;
  /** Required skill level (1-10) for this rank */
  skillReq?: number;
}

export interface Employer {
  id: string;
  name: string;
  /** Where to go to be taken on and to do the work */
  place: string;
  trade: string;
  /** One piece of work, in words */
  task: string;
  /** Per cent of the player's energy one piece of work takes */
  energy: number;
  /** Career experience one piece of work is worth */
  xp: number;
  /** Primary life skill this workplace cultivates */
  skill?: keyof PlayerSkills;
  grades: Grade[];
}

export const EMPLOYERS: Employer[] = [
  {
    id: 'apapa-port',
    name: 'Apapa Port',
    place: 'the loading bay inside Gate 1, off Wharf Road',
    trade: 'Dock work',
    task: 'Load a lorry: three crates from the pallet',
    energy: 30,
    xp: 20,
    skill: 'craft',
    grades: [
      { title: 'Casual hand', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Dock hand', pay: 9000, from: 3, skillReq: 1 },
      { title: 'Gang leader', pay: 12000, from: 8, skillReq: 3 },
      { title: 'Stevedore Supervisor', pay: 18000, from: 15, skillReq: 5 },
      { title: 'Terminal Wharf Master', pay: 28000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'eko-plaza-site',
    name: 'Eko Mega Plaza site',
    place: 'the yard on the south side of the site, on Broad Street',
    trade: 'Building work',
    task: 'Lay a course: six blocks from the pallet to the wall',
    energy: 25,
    xp: 15,
    skill: 'craft',
    grades: [
      { title: 'Labourer', pay: 5000, from: 0, skillReq: 1 },
      { title: 'Block carrier', pay: 6500, from: 3, skillReq: 1 },
      { title: 'Site hand', pay: 8000, from: 8, skillReq: 3 },
      { title: 'Master Mason', pay: 14000, from: 15, skillReq: 5 },
      { title: 'Project Site Foreman', pay: 22000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'cchub-yaba',
    name: 'CcHUB Yaba Tech Accelerator',
    place: 'the 6th floor innovation lab on Herbert Macaulay Way',
    trade: 'Software Engineering & FinTech',
    task: 'Ship payment API updates and resolve production latency bugs',
    energy: 20,
    xp: 40,
    skill: 'coding',
    grades: [
      { title: 'Junior Dev', pay: 16000, from: 0, skillReq: 1 },
      { title: 'Full-Stack Engineer', pay: 26000, from: 3, skillReq: 1 },
      { title: 'Tech Lead / VP Eng', pay: 42000, from: 8, skillReq: 3 },
      { title: 'Principal Architect', pay: 65000, from: 15, skillReq: 5 },
      { title: 'Chief Technology Officer (CTO)', pay: 95000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'first-bank-marina',
    name: 'Eko Commercial Bank Tower',
    place: 'the treasury banking hall on Marina Corridor',
    trade: 'Corporate Banking & Wealth',
    task: 'Process treasury foreign exchange transactions and verify corporate collateral',
    energy: 20,
    xp: 35,
    skill: 'academics',
    grades: [
      { title: 'Bank Teller', pay: 12000, from: 0, skillReq: 1 },
      { title: 'Relationship Manager', pay: 20000, from: 3, skillReq: 1 },
      { title: 'Credit Risk Analyst', pay: 32000, from: 8, skillReq: 3 },
      { title: 'Branch Manager', pay: 50000, from: 15, skillReq: 5 },
      { title: 'Regional Managing Director', pay: 85000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'new-afrika-shrine',
    name: 'New Afrika Shrine Agidingbi',
    place: 'the soundstage & backstage mixing console',
    trade: 'Music & Afrobeats Production',
    task: 'Rehearse live brass horns and mix multi-track audio masters',
    energy: 25,
    xp: 30,
    skill: 'music',
    grades: [
      { title: 'Session Musician', pay: 10000, from: 0, skillReq: 1 },
      { title: 'Sound Producer', pay: 18000, from: 3, skillReq: 1 },
      { title: 'Recording Artist', pay: 30000, from: 8, skillReq: 3 },
      { title: 'Concert Headliner', pay: 48000, from: 15, skillReq: 5 },
      { title: 'Record Label Executive', pay: 75000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'balogun-textiles',
    name: 'Balogun Wholesale Market',
    place: 'the commercial textile plaza on Martins Street',
    trade: 'Wholesale Trade & Importation',
    task: 'Unload Swiss lace bales and negotiate container consignment prices',
    energy: 25,
    xp: 25,
    skill: 'hustle',
    grades: [
      { title: 'Market Apprentice', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Sales Attendant', pay: 11000, from: 3, skillReq: 1 },
      { title: 'Import Broker', pay: 22000, from: 8, skillReq: 3 },
      { title: 'Bulk Textile Wholesaler', pay: 38000, from: 15, skillReq: 5 },
      { title: 'Market Merchant Mogul', pay: 65000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'st-nicholas-hosp',
    name: 'St. Nicholas Hospital',
    place: 'the inpatient clinical ward on Lagos Island',
    trade: 'Clinical Healthcare & Nursing',
    task: 'Administer intravenous medications and update patient recovery charts',
    energy: 25,
    xp: 30,
    skill: 'academics',
    grades: [
      { title: 'Auxiliary Nurse', pay: 9000, from: 0, skillReq: 1 },
      { title: 'Staff Nurse', pay: 16000, from: 3, skillReq: 1 },
      { title: 'Senior Clinical Nurse', pay: 26000, from: 8, skillReq: 3 },
      { title: 'Nursing Matron', pay: 42000, from: 15, skillReq: 5 },
      { title: 'Hospital Clinical Director', pay: 68000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'tiwa-salon-barbers',
    name: 'Tiwa Luxury Salon & Grooming',
    place: 'the styling lounge on Admiralty Way, Lekki',
    trade: 'Hair Styling & Barbering',
    task: 'Carve precision skin fades and weave designer goddess braids',
    energy: 20,
    xp: 20,
    skill: 'craft',
    grades: [
      { title: 'Salon Apprentice', pay: 5000, from: 0, skillReq: 1 },
      { title: 'Junior Stylist', pay: 9500, from: 3, skillReq: 1 },
      { title: 'Master Barber / Braider', pay: 16000, from: 8, skillReq: 3 },
      { title: 'Salon Director', pay: 28000, from: 15, skillReq: 5 },
      { title: 'Celebrity Glamour Stylist', pay: 52000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'amala-shitta-surulere',
    name: 'Amala Shitta Bukateria',
    place: 'the commercial kitchen hearth in Surulere',
    trade: 'Culinary Arts & Traditional Cuisine',
    task: 'Turn piping hot fluffy Amala in large pots and spice simmering gbegiri',
    energy: 25,
    xp: 25,
    skill: 'cooking',
    grades: [
      { title: 'Kitchen Prep', pay: 7000, from: 0, skillReq: 1 },
      { title: 'Line Cook', pay: 12000, from: 3, skillReq: 1 },
      { title: 'Buka Sous Chef', pay: 20000, from: 8, skillReq: 3 },
      { title: 'Head Executive Chef', pay: 35000, from: 15, skillReq: 5 },
      { title: 'Renowned Restaurateur', pay: 60000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'quilox-vi',
    name: 'Club Quilox Victoria Island',
    place: 'the elevated sound DJ booth on Ozumba Mbadiwe',
    trade: 'DJ & Nightlife Performance',
    task: 'Beatmatch high-energy Amapiano transitions and hype the VIP crowd',
    energy: 20,
    xp: 35,
    skill: 'music',
    grades: [
      { title: 'Sound Assistant', pay: 7000, from: 0, skillReq: 1 },
      { title: 'Resident Club DJ', pay: 14000, from: 3, skillReq: 1 },
      { title: 'VIP Lounge DJ', pay: 24000, from: 8, skillReq: 3 },
      { title: 'Festival Headliner', pay: 40000, from: 15, skillReq: 5 },
      { title: 'International Touring DJ', pay: 70000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'i-fitness-lekki',
    name: 'i-Fitness Gym & Wellness',
    place: 'the cardio and power training floor, Lekki Phase 1',
    trade: 'Fitness Coaching & Athletic Training',
    task: 'Lead high-intensity interval routines and supervise barbell squats',
    energy: 30,
    xp: 25,
    skill: 'fitness',
    grades: [
      { title: 'Floor Assistant', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Personal Trainer', pay: 12500, from: 3, skillReq: 1 },
      { title: 'High-Intensity Coach', pay: 22000, from: 8, skillReq: 3 },
      { title: 'Fitness Club GM', pay: 34000, from: 15, skillReq: 5 },
      { title: 'Elite Wellness Brand Founder', pay: 58000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'red-tv-studios',
    name: 'RED TV Creative Studios',
    place: 'the production soundstage in Ikoyi',
    trade: 'Content Creation & Digital Media',
    task: 'Film cinematic Lagos lifestyle reels and edit viral digital comedy sketches',
    energy: 20,
    xp: 30,
    skill: 'charisma',
    grades: [
      { title: 'Street Vlogger', pay: 7500, from: 0, skillReq: 1 },
      { title: 'Viral Creator', pay: 15000, from: 3, skillReq: 1 },
      { title: 'Sponsored Influencer', pay: 26000, from: 8, skillReq: 3 },
      { title: 'Executive Producer', pay: 44000, from: 15, skillReq: 5 },
      { title: 'Media Network Mogul', pay: 75000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'unilag-academics',
    name: 'University of Lagos (UNILAG)',
    place: 'the Faculty of Social Sciences lecture theatre, Akoka',
    trade: 'Higher Education & Research',
    task: 'Deliver undergraduate lectures and grade semester exam scripts',
    energy: 20,
    xp: 30,
    skill: 'academics',
    grades: [
      { title: 'Private Tutor', pay: 7000, from: 0, skillReq: 1 },
      { title: 'Classroom Teacher', pay: 13000, from: 3, skillReq: 1 },
      { title: 'Senior Lecturer', pay: 22000, from: 8, skillReq: 3 },
      { title: 'Department Head', pay: 36000, from: 15, skillReq: 5 },
      { title: 'University Professor', pay: 62000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'zapphaire-events',
    name: 'Zapphaire Event Production',
    place: 'the Eko Convention Centre banquet hall',
    trade: 'Event Production & Wedding Planning',
    task: 'Coordinate celebrity guest arrivals and inspect VIP floral table arrangements',
    energy: 20,
    xp: 25,
    skill: 'charisma',
    grades: [
      { title: 'Event Usher', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Floor Coordinator', pay: 12000, from: 3, skillReq: 1 },
      { title: 'Senior Event Planner', pay: 22000, from: 8, skillReq: 3 },
      { title: 'Creative Producer', pay: 36000, from: 15, skillReq: 5 },
      { title: 'High Society Gala Director', pay: 62000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'sporting-lagos-fc',
    name: 'Sporting Lagos Football Club',
    place: 'the Onikan Stadium pitch, Lagos Island',
    trade: 'Professional Football Athletics',
    task: 'Execute tactical passing drills and score game-winning free kicks',
    energy: 35,
    xp: 30,
    skill: 'fitness',
    grades: [
      { title: 'Academy Prospect', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Reserve League Player', pay: 13000, from: 3, skillReq: 1 },
      { title: 'NPFL First Team Starter', pay: 25000, from: 8, skillReq: 3 },
      { title: 'Club Captain', pay: 42000, from: 15, skillReq: 5 },
      { title: 'International Super Eagle', pay: 80000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'shoprite-ikeja',
    name: 'Shoprite Mega City Mall',
    place: 'the checkout concourse at Ikeja City Mall',
    trade: 'Supermarket & Retail Commerce',
    task: 'Scan barcode items swiftly and reconcile POS register receipts',
    energy: 20,
    xp: 20,
    skill: 'hustle',
    grades: [
      { title: 'Retail Cashier', pay: 6000, from: 0, skillReq: 1 },
      { title: 'Sales Associate', pay: 10000, from: 3, skillReq: 1 },
      { title: 'Floor Supervisor', pay: 17000, from: 8, skillReq: 3 },
      { title: 'Store Manager', pay: 29000, from: 15, skillReq: 5 },
      { title: 'Retail Chain Director', pay: 52000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'air-peace-mma',
    name: 'Air Peace Commercial Operations',
    place: 'the domestic terminal flight deck, MMA2 Ikeja',
    trade: 'Aviation Flight Operations',
    task: 'Calculate flight fuel burns and execute smooth crosswind landings',
    energy: 25,
    xp: 45,
    skill: 'driving',
    grades: [
      { title: 'Cadet Trainee', pay: 18000, from: 0, skillReq: 1 },
      { title: 'First Officer', pay: 32000, from: 3, skillReq: 1 },
      { title: 'Regional Captain', pay: 52000, from: 8, skillReq: 3 },
      { title: 'Long-Haul Captain', pay: 78000, from: 15, skillReq: 5 },
      { title: 'Fleet Chief Pilot', pay: 120000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'ibom-air-cabin',
    name: 'Ibom Air In-Flight Operations',
    place: 'the Airbus A220 passenger cabin, MMA2',
    trade: 'In-Flight Hospitality & Safety',
    task: 'Conduct pre-flight emergency briefings and serve in-flight gourmet snacks',
    energy: 20,
    xp: 30,
    skill: 'charisma',
    grades: [
      { title: 'Trainee Attendant', pay: 10000, from: 0, skillReq: 1 },
      { title: 'Flight Attendant', pay: 18000, from: 3, skillReq: 1 },
      { title: 'Senior Crew Member', pay: 28000, from: 8, skillReq: 3 },
      { title: 'In-Flight Purser', pay: 42000, from: 15, skillReq: 5 },
      { title: 'Cabin Services Director', pay: 66000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'ncaa-atc-tower',
    name: 'NCAA Air Traffic Control Tower',
    place: 'the elevated radar control room, Murtala Muhammed Airport',
    trade: 'Airspace & Radar Management',
    task: 'Sequence incoming international arrivals and issue runway clearance',
    energy: 25,
    xp: 40,
    skill: 'academics',
    grades: [
      { title: 'ATC Cadet', pay: 16000, from: 0, skillReq: 1 },
      { title: 'Tower Controller', pay: 28000, from: 3, skillReq: 1 },
      { title: 'Radar Approach Controller', pay: 42000, from: 8, skillReq: 3 },
      { title: 'En-Route Area Controller', pay: 60000, from: 15, skillReq: 5 },
      { title: 'Airspace Chief Controller', pay: 90000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'sahcol-ground-crew',
    name: 'Skyway Aviation Handling (SAHCO)',
    place: 'the airport tarmac ramp & baggage sorting hall',
    trade: 'Airport Ramp & Ground Handling',
    task: 'Marshall widebody aircraft to gate and coordinate cargo belt loaders',
    energy: 30,
    xp: 25,
    skill: 'craft',
    grades: [
      { title: 'Baggage Handler', pay: 7500, from: 0, skillReq: 1 },
      { title: 'Ramp Agent', pay: 13000, from: 3, skillReq: 1 },
      { title: 'Aircraft Marshaler', pay: 20000, from: 8, skillReq: 3 },
      { title: 'Ramp Supervisor', pay: 32000, from: 15, skillReq: 5 },
      { title: 'Ground Operations Manager', pay: 52000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'faan-aviation-sec',
    name: 'FAAN Aviation Security (AVSEC)',
    place: 'the international screening checkpoint, MMA',
    trade: 'Airport & Border Security',
    task: 'Operate dual-view luggage X-ray scanners and verify biometric boarding passes',
    energy: 20,
    xp: 30,
    skill: 'fitness',
    grades: [
      { title: 'Security Guard', pay: 8500, from: 0, skillReq: 1 },
      { title: 'Screening Specialist', pay: 15000, from: 3, skillReq: 1 },
      { title: 'Surveillance Officer', pay: 24000, from: 8, skillReq: 3 },
      { title: 'Aviation Security Commander', pay: 38000, from: 15, skillReq: 5 },
      { title: 'FAAN Security Director', pay: 62000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'dana-checkin-desk',
    name: 'Commercial Airline Check-In Concourse',
    place: 'Terminal Departure Hall Check-In Desks 1-12',
    trade: 'Passenger Ticketing & Customer Service',
    task: 'Issue boarding passes, tag check-in luggage, and resolve overbooking queries',
    energy: 20,
    xp: 25,
    skill: 'charisma',
    grades: [
      { title: 'Desk Trainee', pay: 7500, from: 0, skillReq: 1 },
      { title: 'Passenger Agent', pay: 13500, from: 3, skillReq: 1 },
      { title: 'Premium Check-in Lead', pay: 21000, from: 8, skillReq: 3 },
      { title: 'Terminal Duty Supervisor', pay: 34000, from: 15, skillReq: 5 },
      { title: 'Passenger Services Director', pay: 55000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'ph-refinery',
    name: 'Port Harcourt Petroleum Refinery',
    place: 'the main process plant gate on Eleme Road',
    trade: 'Petrochemical Engineering',
    task: 'Calibrate catalytic cracking valves and clear tanker dispatch',
    energy: 30,
    xp: 35,
    skill: 'craft',
    grades: [
      { title: 'Safety Trainee', pay: 12000, from: 0, skillReq: 1 },
      { title: 'Plant Technician', pay: 18000, from: 3, skillReq: 1 },
      { title: 'Operations Lead', pay: 26000, from: 8, skillReq: 3 },
      { title: 'Reservoir Lead Specialist', pay: 45000, from: 15, skillReq: 5 },
      { title: 'Offshore Operations Director', pay: 80000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'dangote-refinery-ops',
    name: 'Dangote Mega Refinery & Petrochemicals',
    place: 'the crude distillation unit control room, Lekki Free Zone',
    trade: 'Refinery Plant Operations',
    task: 'Monitor thermal cracking columns and balance hydrotreater pressures',
    energy: 25,
    xp: 40,
    skill: 'craft',
    grades: [
      { title: 'Trainee Operator', pay: 12000, from: 0, skillReq: 1 },
      { title: 'Control Room Tech', pay: 20000, from: 3, skillReq: 1 },
      { title: 'Process Senior Operator', pay: 32000, from: 8, skillReq: 3 },
      { title: 'Operations Shift Supervisor', pay: 50000, from: 15, skillReq: 5 },
      { title: 'Refinery General Plant Manager', pay: 82000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'nlng-hse-bonny',
    name: 'Nigeria LNG (NLNG) Health & Safety',
    place: 'the industrial safety corridor, Bonny Island Plant',
    trade: 'Health, Safety & Environment (HSE)',
    task: 'Conduct toxic vapor gas tests and enforce industrial PPE compliance',
    energy: 25,
    xp: 35,
    skill: 'academics',
    grades: [
      { title: 'HSE Field Assistant', pay: 10000, from: 0, skillReq: 1 },
      { title: 'Safety Inspector', pay: 18000, from: 3, skillReq: 1 },
      { title: 'Senior HSE Specialist', pay: 28000, from: 8, skillReq: 3 },
      { title: 'Industrial Safety Manager', pay: 44000, from: 15, skillReq: 5 },
      { title: 'Corporate Environmental Director', pay: 70000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'bua-haulage-transport',
    name: 'BUA Logistics & Interstate Haulage',
    place: 'the heavy haulage logistics depot, Apapa-Oshodi Expressway',
    trade: 'Heavy Tanker Haulage & Logistics',
    task: 'Couple 45,000-litre fuel tankers and pilot long-distance interstate routes',
    energy: 30,
    xp: 30,
    skill: 'driving',
    grades: [
      { title: 'Motor Boy Assistant', pay: 6500, from: 0, skillReq: 1 },
      { title: 'Haulage Driver', pay: 13000, from: 3, skillReq: 1 },
      { title: 'Interstate Tanker Pilot', pay: 23000, from: 8, skillReq: 3 },
      { title: 'Heavy Fleet Supervisor', pay: 38000, from: 15, skillReq: 5 },
      { title: 'Logistics Haulage Mogul', pay: 64000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'pathcare-laboratories',
    name: 'PathCare Diagnostic Laboratories',
    place: 'the sterile pathology testing lab in Victoria Island',
    trade: 'Diagnostic Laboratory Technology',
    task: 'Run automated blood centrifuge analyzers and verify microbial cultures',
    energy: 20,
    xp: 35,
    skill: 'academics',
    grades: [
      { title: 'Lab Assistant', pay: 9000, from: 0, skillReq: 1 },
      { title: 'Clinical Analyst', pay: 16000, from: 3, skillReq: 1 },
      { title: 'Senior Microbiologist', pay: 26000, from: 8, skillReq: 3 },
      { title: 'Quality Assurance Head', pay: 40000, from: 15, skillReq: 5 },
      { title: 'Chief Diagnostic Director', pay: 65000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'lastma-warden',
    name: 'LASTMA Traffic Management Authority',
    place: 'the Broad Street & Marina traffic corridor',
    trade: 'Traffic enforcement & urban mobility',
    task: 'Direct intersection traffic flow and penalize BRT lane violators',
    energy: 25,
    xp: 25,
    skill: 'driving',
    grades: [
      { title: 'Cadet Warden', pay: 8500, from: 0, skillReq: 1 },
      { title: 'Senior Controller', pay: 14000, from: 3, skillReq: 1 },
      { title: 'Sector Commander', pay: 22000, from: 8, skillReq: 3 },
      { title: 'Zonal Provost Marshal', pay: 34000, from: 15, skillReq: 5 },
      { title: 'State Operations Director', pay: 55000, from: 25, skillReq: 7 },
    ],
  },
  {
    id: 'lagos-transit',
    name: 'Lagos State Transit & Danfo Union',
    place: 'the Broad Street Danfo Terminus rank',
    trade: 'Commercial transit operations',
    task: 'Drive commercial shuttle routes and collect passenger fares',
    energy: 20,
    xp: 25,
    skill: 'driving',
    grades: [
      { title: 'Route Conductor', pay: 7500, from: 0, skillReq: 1 },
      { title: 'Commercial Pilot', pay: 12000, from: 3, skillReq: 1 },
      { title: 'Interstate Bus Captain', pay: 20000, from: 8, skillReq: 3 },
      { title: 'Route Union Marshal', pay: 30000, from: 15, skillReq: 5 },
      { title: 'Fleet Master', pay: 48000, from: 25, skillReq: 7 },
    ],
  },
];

interface Service {
  /** The game day they were taken on */
  since: number;
  done: number;
}

export interface WorkResult {
  ok: boolean;
  reason?: string;
  pay?: number;
  /** The grade just reached, if this piece of work earned one */
  promoted?: Grade;
}

const STORE = 'nigeria_life_employment_v1';

export class Employment {
  private static instance: Employment | null = null;
  private readonly backend = BackendService.getInstance();
  private records: { [employerId: string]: Service } = {};
  private listeners: Array<() => void> = [];
  /** The day on the game's calendar, for the date someone was taken on */
  public today: () => number = () => 1;

  public static get(): Employment {
    if (!Employment.instance) Employment.instance = new Employment();
    return Employment.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || '{}');
      for (const employer of EMPLOYERS) {
        const record = saved?.[employer.id];
        if (record && Number.isFinite(record.done)) this.records[employer.id] = { since: Number(record.since) || 1, done: Math.max(0, Math.floor(record.done)) };
      }
    } catch {
      // A record that cannot be read back is as if they had never worked there
    }
  }

  private changed(): void {
    try {
      localStorage.setItem(profileKey(STORE), JSON.stringify(this.records));
    } catch {
      // Storage shut off: the job holds until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  public employer(id: string): Employer | null {
    return EMPLOYERS.find((one) => one.id === id) ?? null;
  }

  public isEmployed(id: string): boolean {
    return !!this.records[id];
  }

  /** How many pieces of work have been done there. */
  public done(id: string): number {
    return this.records[id]?.done ?? 0;
  }

  public since(id: string): number | null {
    return this.records[id]?.since ?? null;
  }

  /** The grade someone who has done this much work is on. */
  public grade(id: string): Grade | null {
    const employer = this.employer(id);
    if (!employer) return null;
    const done = this.done(id);
    const skills = this.backend.getSkills();
    const skillLevel = employer.skill ? (skills[employer.skill] ?? 1) : 10;
    return [...employer.grades].reverse().find((grade) => {
      const workMet = done >= grade.from;
      const skillMet = grade.skillReq ? skillLevel >= grade.skillReq : true;
      return workMet && skillMet;
    }) ?? employer.grades[0];
  }

  /** The grade above the one they are on, if there is one. */
  public nextGrade(id: string): Grade | null {
    const employer = this.employer(id);
    const now = this.grade(id);
    if (!employer || !now) return null;
    return employer.grades[employer.grades.indexOf(now) + 1] ?? null;
  }

  /** Everywhere the player works. */
  public jobs(): Array<{ employer: Employer; grade: Grade; next: Grade | null; done: number; since: number }> {
    return EMPLOYERS.filter((employer) => this.isEmployed(employer.id)).map((employer) => ({
      employer,
      grade: this.grade(employer.id)!,
      next: this.nextGrade(employer.id),
      done: this.done(employer.id),
      since: this.records[employer.id].since,
    }));
  }

  /** Taken on. Someone who worked there before and left starts again from the bottom. */
  public apply(id: string): { ok: boolean; reason?: string } {
    const employer = this.employer(id);
    if (!employer) return { ok: false, reason: 'Nobody is hiring there.' };
    if (this.isEmployed(id)) return { ok: false, reason: `You already work at ${employer.name}.` };
    this.records[id] = { since: this.today(), done: 0 };
    this.changed();
    return { ok: true };
  }

  public resign(id: string): boolean {
    if (!this.records[id]) return false;
    delete this.records[id];
    this.changed();
    return true;
  }

  /** Why a piece of work cannot be started now, or null if it can. */
  public cannotWork(id: string): string | null {
    const employer = this.employer(id);
    if (!employer) return 'There is no work there.';
    if (!this.isEmployed(id)) return `You do not work at ${employer.name}. Ask to be taken on first.`;
    if (this.backend.getData().stats.energy < employer.energy) return `You are too tired for it (it takes ${employer.energy}% energy). Eat or rest first.`;
    return null;
  }

  /**
   * One piece of work is finished. It is paid for here, once, at the rate of the grade they
   * were on when they did it; it takes its energy, counts toward the next grade and counts
   * for the player's career.
   */
  public complete(id: string): WorkResult {
    const employer = this.employer(id);
    const record = this.records[id];
    const grade = this.grade(id);
    if (!employer || !record || !grade) return { ok: false, reason: 'You do not work there.' };
    const paid = this.backend.performGig(grade.pay, employer.energy, `${grade.title}, ${employer.name}`);
    if (!paid.success) return { ok: false, reason: paid.message };
    this.backend.addJobExperience(employer.xp);
    if (employer.skill) {
      this.backend.addSkillXp(employer.skill, 1);
    }
    record.done += 1;
    const now = this.grade(id)!;
    this.changed();
    return { ok: true, pay: grade.pay, promoted: now !== grade ? now : undefined };
  }
}

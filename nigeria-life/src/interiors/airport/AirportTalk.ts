import type * as THREE from 'three';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { Greeters, goodDay, naira, oga, ogaMi, sir, tipChoices, type TalkSpot } from '../../interactions/Talk';
import { cabChoices, hallCity, ARRIVAL_AIRTIME_PRICE, ARRIVAL_SIM_PRICE } from '../../travel/AirportHall';
import { AIRLINE, AIRPORTS, FlightService, type FlightCity } from '../../travel/Flights';
import type { InteriorNPCDef } from '../InteriorTypes';
import type { AirportServices } from './AirportServices';

type Choice = { label: string; note?: string; pick: () => void };

/** Something to know about each city, told at the information desk */
const ABOUT: Record<FlightCity, string[]> = {
  lagos: [
    'Eko o ni baje! It means "Lagos will not spoil". Lagos is the biggest city in Nigeria, more than fifteen million people, and it never sleeps.',
    'The Third Mainland Bridge, from the Mainland to the Island, is close to twelve kilometres over the lagoon. Cross it at sunset if you can.',
    'For the beach, Elegushi and Tarkwa Bay. For food, try suya at night and amala in the afternoon. For shopping, Balogun market, but hold your phone well.',
  ],
  abuja: [
    'Welcome to Abuja, the Federal Capital Territory, the Centre of Unity. It became the capital in 1991.',
    'Aso Rock stands over the city, about four hundred metres of granite. The National Mosque and the National Christian Centre face each other across the road.',
    'Abuja roads are wide and the city is calm. Try Jabi Lake in the evening, and the suya at Wuse.',
  ],
  port_harcourt: [
    'Welcome to Port Harcourt, the Garden City, in Rivers State. It was founded in 1912 and it is the home of Nigeria’s oil and gas.',
    'Eat bole and fish by the waterside, and try the native soups: oha, and fisherman soup.',
    'The Pleasure Park and the old township are worth a visit. And the people here love their football.',
  ],
  ibadan: ['Ibadan: the ancient city of brown roofs.'],
};

/**
 * What the people working in the terminal say to a passenger who walks up to them: a greeting
 * that knows the time of day and whether to say sir or ma, then the things that can be done there
 * as answers to pick (buy a ticket, check in, a SIM on promo, a cab into town), and questions that
 * get a real answer. Some ask for something for the boys, the Lagos way.
 */
export class AirportTalk {
  public readonly greeters: Greeters;
  private readonly flights = FlightService.get();

  private readonly services: AirportServices;

  constructor(npcs: InteriorNPCDef[], services: AirportServices, origin: THREE.Vector3) {
    this.services = services;
    const spots: TalkSpot[] = [];
    for (const def of npcs) {
      const open = this.conversation(def);
      if (!open) continue;
      const id = `interior_npc_${def.id}`;
      // Where the passenger stands to speak to them: in front of them (across the counter for desk staff)
      const reach = def.relativePosition;
      spots.push({ id, x: reach.x + Math.sin(def.rotationY) * 1.15, z: reach.z + Math.cos(def.rotationY) * 1.15, radius: 1.25, open });
      PlaceActions.register(id, { label: () => `💬 Talk to ${def.name.split(' ')[0]}`, run: () => this.greeters.open(id) });
    }
    this.greeters = new Greeters(spots, origin);
  }

  public update(delta: number): void {
    this.greeters.tick(delta);
  }

  private city(): FlightCity {
    return hallCity();
  }

  /** A card from a person, with "That's all, thank you" at the end */
  private say(host: PlaceHost, who: string, role: string, text: string, choices: Choice[], bye = `You are welcome, ${sir()}. Have a lovely day!`): void {
    host.ask({
      who,
      role,
      text,
      choices: [...choices, { label: 'That’s all, thank you', pick: () => host.say(`${who.split(' ')[0]}: "${bye}"`, 'info') }],
    });
  }

  private conversation(def: InteriorNPCDef): ((host: PlaceHost) => void) | null {
    const first = def.name.replace(/^(Officer|Capt\.|Chief)\s+/, '').split(' ')[0];
    switch (def.id) {
      case 'npc_info_grace':
        return (host) => this.information(host, def.name);
      case 'npc_checkin_funke':
      case 'npc_checkin_tunde':
      case 'npc_checkin_amaka':
        return (host) => this.checkIn(host, def.name);
      case 'npc_officer_ngozi':
      case 'npc_officer_dauda':
        return (host) => this.security(host, def.name, def.id === 'npc_officer_dauda');
      case 'npc_gate1_zainab':
        return (host) => this.gate(host, def.name, 1);
      case 'npc_gate2_efe':
        return (host) => this.gate(host, def.name, 2);
      case 'npc_captain_ibrahim':
        return (host) => this.captain(host, def.name);
      case 'npc_cafe_blessing':
        return (host) => this.services.cafeMenu(host, `Welcome, ${sir()}! Welcome to Buka Express. What can I serve you? We have hot jollof rice and chicken, fried rice and dodo, fresh meat pie, puff-puff, coffee, chilled zobo and Chapman. Pick, I will bring it to your table.`);
      case 'npc_shop_sule':
        return (host) => this.services.shopMenu(host, `${goodDay()}, ${sir()}! Welcome to Naija Mart. Anything for the journey? Cold drinks, chin-chin, plantain chips, and power banks if your phone is crying.`);
      case 'npc_lounge_ifeoma':
        return (host) => this.lounge(host, def.name);
      case 'npc_sim_desk':
        return (host) => this.sim(host, def.name);
      case 'npc_cab_desk':
        return (host) => this.cab(host, def.name);
      case 'npc_cleaner_titi':
        return (host) => this.say(host, def.name, 'Cleaner · Terminal Services', `${goodDay()}, ${sir()}! Mind the wet floor o. You are welcome to ${AIRPORTS[this.city()].city}.`,
          tipChoices(host, first, [200, 500], `God bless you, ${sir()}! Journey mercies.`, `No wahala, ${sir()}. God bless you anyway!`), `Thank you, ${sir()}! Safe journey.`);
      case 'npc_porter_musa':
        return (host) => this.say(host, def.name, 'Porter · Baggage Hall', `${ogaMi()}! Welcome, welcome! Make I help you carry your load go the cab? Na small thing, ${oga().toLowerCase()}.`,
          tipChoices(host, first, [1000, 300], `${oga()}, God go bless you! Your load don reach the kerb.`, `No wahala, ${oga().toLowerCase()}. God go bless you!`,
            ['🧳 Yes, carry it to the cab', 'Here, ₦300 for pure water', 'No, I can manage']), `Okay ${oga().toLowerCase()}, enjoy ${AIRPORTS[this.city()].city}!`);
      default:
        return null;
    }
  }

  // --- The information desk -------------------------------------------------------------------------

  private information(host: PlaceHost, who: string, text?: string): void {
    const city = this.city();
    const airport = AIRPORTS[city];
    const again = (answer: string) => this.information(host, who, `${answer}\n\nAnything else I can help you with?`);
    const routes = this.flights.routesFrom(city);
    const held = this.flights.booking;
    const choices: Choice[] = [
      {
        label: '✈️ Which flights are leaving?',
        pick: () => again(routes.length
          ? `Today from ${airport.city}: ${routes.map((r) => `${r.flight} to ${AIRPORTS[r.to].city} from Gate ${r.gate}, ${naira(r.fare)}, ${r.minutes} minutes in the air`).join('; ')}. Buy your ticket at the ${AIRLINE} counters on your left.`
          : 'No flights leave from here today.'),
      },
      ...(held && held.route.from === city
        ? [{
            label: `🎫 What about my flight, ${held.route.flight}?`,
            pick: () => again(held.state === 'booked'
              ? `${held.route.flight} to ${AIRPORTS[held.route.to].city}, seat ${held.seat}. You have not checked in yet: go to the counters on your left.`
              : held.state === 'checked-in'
                ? `You are checked in for ${held.route.flight}. Security is straight ahead, then Gate ${held.route.gate}.`
                : `You are through security. ${held.route.flight} boards from Gate ${held.route.gate}, by the windows.`),
          }]
        : []),
      { label: '🧳 Where do I collect my bags?', pick: () => again('Baggage claim is on your right: Belt 1. The SIM desk and the cab desk are just after it, by the doors.') },
      { label: '🚻 Toilets and prayer rooms?', pick: () => again('After security. The toilets are beside the café, and the mosque and chapel are beside the Executive Lounge, by the big windows.') },
      { label: '🍲 Where can I eat?', pick: () => again('Buka Express, after security by the windows: jollof, fried rice, meat pie, puff-puff and coffee. Naija Mart sells drinks and snacks.') },
      { label: '🚕 How do I get into town?', pick: () => again(`The registered cab desk is in arrivals: into ${airport.city} for a fixed fare. You can also book a ride on your phone and meet it at the kerb.`) },
      { label: `🌍 Tell me about ${airport.city}`, pick: () => again(ABOUT[city][Math.floor(Math.random() * ABOUT[city].length)]) },
    ];
    this.say(host, who, `Information · ${airport.name}`, text ?? `${goodDay()}, ${sir()}! Welcome to ${airport.name}. How may I help you today? What information do you need?`, choices, `You are welcome, ${sir()}. Enjoy ${airport.city}!`);
  }

  // --- Check-in ---------------------------------------------------------------------------------------

  private checkIn(host: PlaceHost, who: string): void {
    const city = this.city();
    const held = this.flights.booking;
    const desk = () => PlaceActions.get('airport_checkin_desk')?.run(host);
    const mine = held && held.route.from === city ? held : null;
    let text = `${goodDay()}, ${sir()}! Welcome to ${AIRLINE}. How may I help you today?`;
    const choices: Choice[] = [];
    if (!mine) {
      choices.push({ label: '🎫 I want to buy a ticket', note: 'Where to?', pick: desk });
    } else if (mine.state === 'booked') {
      text += ` I can see your booking: ${mine.route.flight} to ${AIRPORTS[mine.route.to].city}, seat ${mine.seat}.`;
      choices.push({ label: '🧳 Check me in', note: `Gate ${mine.route.gate}`, pick: desk });
    } else {
      text = `${goodDay()}, ${sir()}! You are checked in for ${mine.route.flight}, seat ${mine.seat}. ${mine.state === 'cleared' ? `Go to Gate ${mine.route.gate}.` : 'Security is straight ahead.'}`;
    }
    choices.push(
      { label: '💺 Can I have a window seat?', pick: () => host.say(`${who.split(' ')[0]}: "${mine ? `I will note it, ${sir()}. If the window is free at the gate, it is yours.` : `Buy your ticket first, ${sir()}, then I will see what I can do.`}"`, 'info') },
      { label: '🧳 How many kilos can I carry?', pick: () => host.say(`${who.split(' ')[0]}: "23 kilos in the hold and 7 in the cabin, ${sir()}. One handbag on top."`, 'info') },
    );
    this.say(host, who, `Check-in · ${AIRLINE}`, text, choices);
  }

  // --- Security ---------------------------------------------------------------------------------------

  private security(host: PlaceHost, who: string, asks: boolean): void {
    const held = this.flights.booking;
    const through = held?.state === 'cleared';
    if (through && asks) {
      this.say(host, who, 'FAAN Aviation Security', `${ogaMi()}! You don pass, journey mercies. Abeg, anything for the boys? Make we buy pure water, the sun hot well well today.`,
        tipChoices(host, who.replace('Officer ', '').split(' ')[0], [500, 1000], `${oga()}, you too much! God go bless your journey.`, `No wahala, ${oga().toLowerCase()}. Safe flight!`), `Okay ${sir()}, safe flight!`);
      return;
    }
    const lane = () => PlaceActions.get('airport_security_gate')?.run(host);
    this.say(host, who, 'FAAN Aviation Security', through
      ? `You are through, ${sir()}. Your gate is by the windows. Safe flight!`
      : `${goodDay()}, ${sir()}. Welcome to screening. Boarding pass, please. Phones, belt, watch and coins in the tray, then walk through the arch.`, [
      ...(through ? [] : [{ label: '🛂 Here is my boarding pass', note: 'Through the arch', pick: lane }]),
      { label: 'Must I remove my shoes?', pick: () => host.say(`${who.replace('Officer ', '').split(' ')[0]}: "Only if the arch beeps, ${sir()}."`, 'info') },
    ], `Thank you, ${sir()}.`);
  }

  // --- The gates --------------------------------------------------------------------------------------

  private gate(host: PlaceHost, who: string, number: 1 | 2): void {
    const city = this.city();
    const route = this.flights.routeAtGate(city, number);
    const held = this.flights.booking;
    const mine = held && held.route.from === city && held.route.gate === number;
    const go = () => PlaceActions.get(number === 1 ? 'airport_flight_abuja' : 'airport_flight_ph')?.run(host);
    const where = route ? `${route.flight} to ${AIRPORTS[route.to].city}` : 'the next flight';
    this.say(host, who, `Gate ${number} · ${AIRLINE}`, mine
      ? `${goodDay()}, ${sir()}! Welcome to Gate ${number}, ${where}. May I see your boarding pass? Then follow the walkway out to the aircraft.`
      : `${goodDay()}, ${sir()}. This is Gate ${number}, ${where}. Have you checked in?`, [
      { label: mine ? '🛫 Here, I am ready to board' : '🛫 Board this flight', pick: go },
      { label: 'Is the flight on time?', pick: () => host.say(`${who.split(' ')[0]}: "On time, by God’s grace! Boarding starts as soon as the aircraft is on the stand."`, 'info') },
    ], `You are welcome, ${sir()}. Enjoy your flight!`);
  }

  private captain(host: PlaceHost, who: string): void {
    this.say(host, who, `Flight Captain · ${AIRLINE}`, `${goodDay()}! I am ${who}. Clear skies today; we expect a smooth flight at twenty-five thousand feet.`, [
      { label: 'How long have you been flying?', pick: () => host.say(`Captain: "Twenty-two years, ${sir()}. Kaduna first, then the big jets. I still love every take-off."`, 'info') },
      { label: 'Can I see the cockpit?', pick: () => host.say(`Captain: "After we land, if the crew are not busy, ${sir()}. Ask the cabin crew."`, 'info') },
    ], 'Thank you! See you on board.');
  }

  // --- The lounge -------------------------------------------------------------------------------------

  private lounge(host: PlaceHost, who: string): void {
    this.say(host, who, 'Executive Lounge', `${goodDay()}, ${sir()}, welcome to the Executive Lounge. Entry is ${naira(40_000)}: small chops, chilled drinks, fast Wi-Fi and a quiet armchair until your flight is called.`, [
      { label: '🥂 Pay and come in', note: naira(40_000), pick: () => this.services.lounge(host) },
      { label: 'What is on the buffet?', pick: () => host.say(`${who}: "Small chops, ${sir()}: samosa, spring rolls, puff-puff, peppered gizzard, and Chapman. Coffee and tea any time."`, 'info') },
    ], `No problem, ${sir()}. We are here when you are ready.`);
  }

  // --- Arrivals: SIMs and cabs -------------------------------------------------------------------------

  private sim(host: PlaceHost, who: string, text?: string): void {
    const city = AIRPORTS[this.city()].city;
    const buy = (network: string, extra: string) => () => {
      const bag = host.backend.getData().inventory;
      if (bag.some((e) => e.id === 'airport_sim')) {
        host.say(`${who}: "You already have a SIM in your bag, ${sir()}. Just top up your airtime."`, 'info');
        return;
      }
      if (!host.backend.pay(ARRIVAL_SIM_PRICE, `${network} prepaid SIM`, 'SHOP_PURCHASE')) {
        host.say(`That is ${naira(ARRIVAL_SIM_PRICE)} and you do not have it.`, 'warning');
        return;
      }
      host.backend.addItem({ id: 'airport_sim', name: `${network} prepaid SIM`, icon: '📱', price: ARRIVAL_SIM_PRICE, category: 'gadget', usable: false, description: `A ${network} SIM bought at ${AIRPORTS[this.city()].name} arrivals. ${extra}` });
      host.backend.modifyNeed('social', 5);
      host.say(`${who}: "Done! Your ${network} line is registered and working. ${extra} Welcome to ${city}!"`, 'success');
    };
    this.say(host, who, 'SIM & Airtime · Arrivals', text ?? `Welcome to ${city}, ${sir()}! 👋 How may I help you today? You need a SIM? MTN is on promo today o: buy any MTN line and get 2GB data free! We also have Airtel, Glo and 9mobile. Which one do you want?`, [
      { label: '📶 MTN line, with the 2GB promo', note: naira(ARRIVAL_SIM_PRICE), pick: buy('MTN', '2GB promo data is loaded.') },
      { label: 'Airtel line', note: naira(ARRIVAL_SIM_PRICE), pick: buy('Airtel', '1GB welcome data is loaded.') },
      { label: 'Glo line', note: naira(ARRIVAL_SIM_PRICE), pick: buy('Glo', 'Glo double data is on.') },
      {
        label: `₦${ARRIVAL_AIRTIME_PRICE} airtime`,
        note: 'Social +5',
        pick: () => {
          if (!host.backend.pay(ARRIVAL_AIRTIME_PRICE, 'Airtime', 'SHOP_PURCHASE')) {
            host.say(`That is ${naira(ARRIVAL_AIRTIME_PRICE)} and you do not have it.`, 'warning');
            return;
          }
          host.backend.modifyNeed('social', 5);
          host.say(`${who}: "Airtime loaded. Call home, tell them you landed safe!"`, 'success');
        },
      },
      { label: 'Which network is best here?', pick: () => this.sim(host, who, `Honestly, ${sir()}? MTN is very strong everywhere in ${city}, you will love it. Airtel is fast for data, Glo gives you more data for the money. Today, MTN promo is the best deal. Which one?`) },
    ], `No wahala, ${sir()}. Enjoy ${city}!`);
  }

  private cab(host: PlaceHost, who: string): void {
    const city = AIRPORTS[this.city()].city;
    this.say(host, who, 'Registered Airport Cabs', `Welcome, ${sir()}! Where you dey go? Our cabs are registered, air-conditioned, fixed price, no wahala. Into ${city} is ${naira(8_500)}.`, [
      ...cabChoices(host),
      { label: 'Why not the men outside?', pick: () => host.say(`${who}: "Ehn, them go charge you double, ${sir()}! Our price is fixed and the driver is registered."`, 'info') },
    ], `Okay, ${sir()}. Safe journey!`);
  }
}

import type * as THREE from 'three';
import { PlaceActions, type PlaceAction, type PlaceHost } from '../destinations/PlaceActions';
import { FlightService, AIRLINE, AIRPORTS, REFUND_SHARE, type FlightCity } from './Flights';

/** What the hall needs to know about the airport it is the inside of. */
export interface HallSetting {
  /** The city the player is in, whose airport this is */
  city(): FlightCity;
  /** Where the door to the apron comes out, in that city */
  apronDoor(): THREE.Vector3 | null;
}

/**
 * The departures hall, which is the same room in every city: a desk that sells tickets and
 * checks passengers in, security, and two gates that lead out to the apron. Each does one
 * step of a booking and nothing else. Nothing in here flies anyone anywhere: the flight is
 * boarded at the aircraft, outside.
 */
export function openAirportHall(setting: HallSetting): void {
  const flights = FlightService.get();
  const cityName = (city: FlightCity) => AIRPORTS[city].city;

  const desk: PlaceAction = {
    label: () => {
      const held = flights.booking;
      if (!held) return '🎫 Buy a ticket';
      if (held.state === 'booked') return `🧳 Check in: ${flights.describe(held.route)}`;
      return `✅ Checked in: ${held.route.flight}, seat ${held.seat}`;
    },
    run: (host: PlaceHost) => {
      const city = setting.city();
      const held = flights.booking;
      if (!held) {
        host.ask({
          who: 'Ticket desk',
          role: `${AIRLINE}  ·  ${AIRPORTS[city].name}`,
          text: 'Where are you flying to?',
          choices: flights.routesFrom(city).map((route) => ({
            label: `${route.flight} to ${cityName(route.to)}`,
            note: `₦${route.fare.toLocaleString()}`,
            pick: () => {
              const sold = flights.book(route, city);
              const ticket = flights.booking;
              host.say(sold.ok && ticket ? `Ticket bought: ${flights.describe(route)}, seat ${ticket.seat}. ₦${route.fare.toLocaleString()} paid. Check in at this desk.` : sold.reason ?? 'The ticket could not be sold.', sold.ok ? 'success' : 'warning');
            },
          })),
        });
        return;
      }
      if (held.route.from !== city) {
        host.say(`Your ticket is for ${flights.describe(held.route)}, which leaves from ${cityName(held.route.from)}.`, 'warning');
        return;
      }
      if (held.state === 'booked') {
        host.ask({
          who: 'Check-in',
          role: `${AIRLINE}  ·  ${AIRPORTS[city].name}`,
          text: `${flights.describe(held.route)}, seat ${held.seat}. Checking in?`,
          choices: [
            {
              label: 'Check in',
              note: `Gate ${held.route.gate}`,
              pick: () => {
                const done = flights.checkIn(city);
                host.say(done.ok ? `Checked in. Boarding pass: ${held.route.flight}, seat ${held.seat}, Gate ${held.route.gate}. Security is next.` : done.reason ?? '', done.ok ? 'success' : 'warning');
              },
            },
            {
              label: 'Hand the ticket back',
              note: `₦${Math.round(held.route.fare * REFUND_SHARE).toLocaleString()} back`,
              pick: () => {
                const back = flights.cancel();
                host.say(back.ok ? `Ticket handed back. ${back.reason}` : back.reason ?? '', back.ok ? 'info' : 'warning');
              },
            },
          ],
        });
        return;
      }
      host.say(held.state === 'checked-in' ? `You are checked in. Go through security, then Gate ${held.route.gate}.` : `You are through security. ${held.route.flight} leaves from Gate ${held.route.gate}.`, 'info');
    },
  };

  const security: PlaceAction = {
    label: () => {
      const held = flights.booking;
      if (held?.state === 'cleared') return '✅ You are through security';
      return '🛂 Go through security';
    },
    run: (host: PlaceHost) => {
      const before = flights.booking?.state;
      const through = flights.clearSecurity(setting.city());
      const held = flights.booking;
      if (!through.ok || !held) {
        host.say(through.reason ?? 'Security wants to see a boarding pass.', 'warning');
        return;
      }
      host.say(before === 'cleared' ? `You are already through. ${held.route.flight} leaves from Gate ${held.route.gate}.` : `Bag scanned, boarding pass checked. ${held.route.flight} leaves from Gate ${held.route.gate}.`, 'success');
    },
  };

  const gate = (number: 1 | 2): PlaceAction => ({
    label: () => {
      const route = flights.routeAtGate(setting.city(), number);
      return route ? `🛫 Gate ${number}: ${route.flight} to ${cityName(route.to)}` : `Gate ${number}`;
    },
    run: (host: PlaceHost) => {
      const city = setting.city();
      const held = flights.booking;
      if (!held || held.route.from !== city) {
        host.say('The gates are for passengers. Buy a ticket at the desk first.', 'info');
        return;
      }
      if (held.state === 'booked') {
        host.say('Check in at the desk first, then go through security.', 'info');
        return;
      }
      if (held.state === 'checked-in') {
        host.say('Go through security first.', 'info');
        return;
      }
      if (held.route.gate !== number) {
        host.say(`${held.route.flight} leaves from Gate ${held.route.gate}, not this one.`, 'info');
        return;
      }
      const out = setting.apronDoor();
      if (!out) return;
      host.say(`Out to the apron. ${held.route.flight} boards at the steps on the stand.`, 'info');
      // Out of the terminal's north door, facing the aircraft
      host.leave(out, Math.PI);
    },
  });

  const baggageClaim: PlaceAction = {
    label: () => {
      const held = flights.booking;
      if (held?.state === 'arrived') return '🧳 Claim your checked luggage';
      return '🧳 Baggage Claim Carousel 1';
    },
    run: (host: PlaceHost) => {
      const city = setting.city();
      const held = flights.booking;
      if (held?.state === 'arrived') {
        host.say(`You retrieved your travel suitcase from Carousel 1 at ${AIRPORTS[city].name}. Luggage verified and cleared! The curbside doors to the street are just ahead.`, 'success');
      } else {
        host.say(`Carousel 1 is circulating luggage for incoming flights at ${AIRPORTS[city].name}. If you are departing, proceed to the ticket desk. Curbside doors lead out to the street.`, 'info');
      }
    },
  };

  PlaceActions.registerAll({
    airport_checkin_desk: desk,
    airport_security_gate: security,
    airport_flight_abuja: gate(1),
    airport_flight_ph: gate(2),
    airport_baggage_carousel: baggageClaim,
  });
}

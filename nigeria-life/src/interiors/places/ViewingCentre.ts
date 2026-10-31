import * as THREE from 'three';
import { MatchSim } from '../../world/landmarks/MatchSim';
import { SoundEngine } from '../../audio/SoundEngine';
import type { PlaceInterior } from './PlaceInterior';
import { Figure } from './Worship';

/**
 * Oga Sunday's: the big screen always has football on it, a match really being played out with
 * the score in the corner; the room hears it, the hum of the fans, the roar when one goes in, a
 * commentator calling it; and the fans in the front row are on their feet for every goal.
 */

const FIXTURES: Array<[string, string]> = [
  ['Super Eagles', 'Black Stars'],
  ['Lagos Lions', 'Abuja Hawks'],
  ['Eko United', 'Rivers Stars'],
  ['Kano Pillars', 'Enyimba'],
  ['Super Eagles', 'Bafana Bafana'],
];

const CALLS = {
  play: ['Lovely ball forward!', 'He beats one man, he beats two!', 'Pressure now on the defence.', 'Corner kick.', 'What a tackle!', 'They are pressing high.', 'Free kick on the edge of the box!', 'He shoots... wide!', 'Brilliant save by the keeper!'],
  goal: ['GOAL! What a finish!', 'GOOOAL! The net is rippling!', 'It is in! What a strike!', 'GOAL! Unbelievable!'],
};

export function attachViewing(room: PlaceInterior): void {
  let fixture = 0;
  let match = new MatchSim(36, 24, FIXTURES[0], 11);
  // The screen: in front of the one built into the wall
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 3.3), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.name = 'viewing screen';
  screen.position.set(0, 2.2, -6.68);
  room.group.add(screen);
  const ctx = canvas.getContext('2d')!;

  // Two fans in front who stand up for a goal
  const fans = [
    new Figure(room.group, 'vc-fan-a', 'Fan', { gender: 'male', username: '', outfitColor: 0x15803d, outfit: 'jersey', hairstyle: 'low_cut' }, [-2.25, 1.2], Math.PI),
    new Figure(room.group, 'vc-fan-b', 'Fan', { gender: 'male', username: '', outfitColor: 0xf8fafc, outfit: 'tshirt', hairstyle: 'fade' }, [3.75, 1.2], Math.PI),
  ];
  for (const fan of fans) fan.pose('sit');

  // The sound of the room: a crowd's hum made from noise, a swell on goals; and the commentator
  let crowd: GainNode | null = null;
  let roar: GainNode | null = null;
  const sound = () => {
    if (crowd) return true;
    const audio = SoundEngine.getInstance().audio(false);
    if (!audio) return false;
    const { ctx: a, master } = audio;
    const length = a.sampleRate * 2;
    const buffer = a.createBuffer(1, length, a.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      // Brown-ish noise: a crowd far more than a hiss
      last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985;
      data[i] = last * 3;
    }
    const make = (freq: number, q: number) => {
      const src = a.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const band = a.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = q;
      const gain = a.createGain();
      gain.gain.value = 0;
      src.connect(band).connect(gain).connect(master);
      src.start(0, Math.random() * 1.5);
      return gain;
    };
    crowd = make(520, 0.7);
    roar = make(1100, 0.5);
    return true;
  };
  const say = (text: string, excited: boolean) => {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!speech || SoundEngine.getInstance().isMuted || speech.speaking) return;
    const line = new SpeechSynthesisUtterance(text);
    line.lang = 'en-NG';
    line.rate = excited ? 1.25 : 1.12;
    line.pitch = excited ? 1.15 : 0.9;
    line.volume = excited ? 0.8 : 0.5;
    speech.speak(line);
  };

  let drawn = 0;
  let goals = 0;
  let nextCall = 6;
  let cheer = 0;
  room.ticks.push((delta) => {
    match.update(delta);
    if (match.fullTime) {
      fixture = (fixture + 1) % FIXTURES.length;
      match = new MatchSim(36, 24, FIXTURES[fixture], 11 + fixture * 7);
      goals = 0;
    }
    // The picture, eight times a second
    drawn += delta;
    if (drawn > 0.12) {
      drawn = 0;
      match.drawBroadcast(ctx, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(10, 10, 300, 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${match.teams[0]} ${match.score[0]} - ${match.score[1]} ${match.teams[1]}`, 20, 27);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(canvas.width - 86, 12, 74, 28);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`LIVE ${match.minute}'`, canvas.width - 49, 27);
      texture.needsUpdate = true;
    }
    // A goal: the roar, the call, the fans up
    if (match.goals !== goals) {
      goals = match.goals;
      cheer = 3.2;
      say(`${CALLS.goal[goals % CALLS.goal.length]} ${match.teams[match.lastScorer ?? 0]}!`, true);
      for (const fan of fans) fan.pose('stand', 'praise');
    }
    if (cheer > 0) {
      cheer -= delta;
      if (cheer <= 0) for (const fan of fans) fan.pose('sit');
    }
    nextCall -= delta;
    if (nextCall <= 0) {
      nextCall = 9 + Math.random() * 9;
      say(CALLS.play[Math.floor(Math.random() * CALLS.play.length)], false);
    }
    for (const fan of fans) fan.tick(delta);
    // The room's sound, faded out by itself if the player leaves (these ticks stop)
    if (sound() && crowd && roar) {
      const a = SoundEngine.getInstance().audio(false)!.ctx;
      const now = a.currentTime;
      for (const [gain, level] of [[crowd, 0.12 + (cheer > 0 ? 0.08 : 0)], [roar, cheer > 0 ? 0.28 * Math.min(1, cheer / 1.5) : 0.015]] as Array<[GainNode, number]>) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(level, now, 0.25);
        gain.gain.setTargetAtTime(0, now + 0.5, 0.2);
      }
    }
  });
}

export type PhoneAppId =
  | 'home'
  | 'jobs'
  | 'messages'
  | 'meetumo'
  | 'eleventhoo'
  | 'popout'
  | 'games'
  | 'nollywood'
  | 'bettips'
  | 'versiah'
  | 'contacts'
  | 'help'
  | 'ride'
  | 'chowdeck'
  | 'bank'
  | 'boutique'
  | 'forbes'
  | 'houses'
  | 'cars'
  | 'invite'
  | 'health'
  | 'dating'
  | 'music'
  | 'invest'
  | 'map';

export interface ChatMessage {
  id?: string;
  sender: 'them' | 'me' | 'system';
  text?: string;
  time: string;
  sticker?: 'lion' | 'fire' | 'heart' | 'money';
  stickerCaption?: string;
  transferAmount?: number;
}

export interface PhoneContact {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  status: string;
  lastMessage: string;
  unread: boolean;
  messages: ChatMessage[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  pay: number;
  energyCost: number;
  durationSeconds: number;
  description: string;
  icon: string;
}

export interface DatingProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  avatar: string;
  liked: boolean;
}

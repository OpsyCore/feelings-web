export type Page = 'home'|'feelings'|'moments'|'care'|'profile'|'memories'|'dates'|'calendar'|'diary'|'coupleCare'|'cycle'|'settings'|'notifications'|'partner'|'couple';
export type Table = 'moods'|'mood_reactions'|'care_signals'|'memories'|'important_dates'|'calendar_events'|'diary_entries'|'cycle_logs'|'notifications';
export interface Entry { id:string; user_id:string; couple_id?:string; created_at:string; updated_at?:string; title?:string; text?:string; body?:string; description?:string; emoji?:string; date?:string; time?:string; photo_path?:string; location?:string; visibility?:'private'|'partner'; repeat_yearly?:boolean; reminder_minutes?:number; signal?:string; sender_id?:string; receiver_id?:string; read_at?:string; mood_id?:string; period_start?:string; period_end?:string; cycle_length?:number; symptoms?:string; notes?:string; type?:string; }
export interface Profile {id:string; name:string; avatar_path?:string|null; birthday?:string|null; locale?:'fa'|'en'; language?:'fa'|'en'; theme?:'light'|'dark'|'system';}
export interface Couple {id:string; created_at:string; relationship_date?:string; partner?:Profile;}
export interface Invitation {code:string; expires_at:string;}
export type EntryInput = Partial<Omit<Entry,'id'|'created_at'>>;
export const tables:Table[] = ['moods','mood_reactions','care_signals','memories','important_dates','calendar_events','diary_entries','cycle_logs','notifications'];
export const pageTables:Partial<Record<Page,Table>> = {feelings:'moods',care:'care_signals',memories:'memories',dates:'important_dates',calendar:'calendar_events',diary:'diary_entries',cycle:'cycle_logs',notifications:'notifications'};

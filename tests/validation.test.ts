import {describe,it,expect} from 'vitest';
import {validateMood,validatePassword,validateEmail,normalizeCode,validCode} from '../src/lib/validation';
import {messages,translate,formatDate,moods,signals} from '../src/lib/i18n';
describe('feeling validation',()=>{
 it('rejects blank and whitespace feelings',()=>{expect(validateMood('')).toBe('selectFeeling');expect(validateMood('   ')).toBe('selectFeeling');});
 it('allows exactly 50 Unicode code points, not 51',()=>{expect(validateMood('ا'.repeat(50))).toBeNull();expect(validateMood('ا'.repeat(51))).toBe('tooLong');expect(validateMood('😀'.repeat(50))).toBeNull();expect(validateMood('😀'.repeat(51))).toBe('tooLong');});
 it('accepts the critical Persian sleepy mood',()=>expect(validateMood('خوابم میاد')).toBeNull());
});
describe('authentication and invitations',()=>{
 it('requires 8 characters including a letter and number',()=>{expect(validatePassword('abcdefgh')).toBe('badPassword');expect(validatePassword('12345678')).toBe('badPassword');expect(validatePassword('abcd123')).toBe('badPassword');expect(validatePassword('abcd1234')).toBeNull();});
 it('checks email structure',()=>{expect(validateEmail('person@example.com')).toBe(true);expect(validateEmail('person@')).toBe(false);expect(validateEmail('a b@example.com')).toBe(false);});
 it('normalizes Persian and Arabic digits',()=>{expect(normalizeCode('۱۲۳۴۵۶')).toBe('123456');expect(normalizeCode('١٢٣٤٥٦')).toBe('123456');});
 it('only accepts six digits',()=>{expect(validCode('۱۲۳۴۵۶')).toBe(true);expect(validCode('12345')).toBe(false);expect(validCode('1234567')).toBe(false);expect(validCode('https://evil.test?invite=123456')).toBe(false);});
});
describe('localization contract',()=>{
 it('has both languages for every message',()=>{for(const [key,pair] of Object.entries(messages)){expect(pair[0],key).toBeTruthy();expect(pair[1],key).toBeTruthy();}});
 it('localizes navigation and presets',()=>{expect(translate('fa','home')).toBe('خانه');expect(translate('en','home')).toBe('Home');for(const item of [...moods,...signals]){expect(item.fa).toBeTruthy();expect(item.en).toBeTruthy();}});
 it('handles invalid dates without crashing',()=>expect(formatDate('invalid','fa')).toBe('—'));
});

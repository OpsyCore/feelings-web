import {test,expect,type BrowserContext,type Page} from '@playwright/test';
const enabled=process.env.RUN_REMOTE_ACCEPTANCE==='true';
const credentials=[{email:process.env.TEST_A_EMAIL,password:process.env.TEST_A_PASSWORD},{email:process.env.TEST_B_EMAIL,password:process.env.TEST_B_PASSWORD}];
test.describe('REAL two-browser acceptance — no mocks',()=>{
 test.skip(!enabled||credentials.some(c=>!c.email||!c.password),'BLOCKED: requires configured/reviewed FEELINGS backend and two dedicated confirmed test accounts.');
 test.describe.configure({mode:'serial'});
 let contextA:BrowserContext,contextB:BrowserContext,a:Page,b:Page;
 async function login(page:Page,index:number){await page.goto('/#profile');const skip=page.getByRole('button',{name:'فعلاً رد می‌کنم',exact:true});if(await skip.isVisible())await skip.click();await page.locator('.profile-identity').getByRole('button').click();await page.getByLabel('ایمیل',{exact:true}).fill(credentials[index].email!);await page.getByLabel('رمز عبور',{exact:true}).fill(credentials[index].password!);await page.getByRole('button',{name:'ورود',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
 test.beforeAll(async({browser})=>{contextA=await browser.newContext();contextB=await browser.newContext();a=await contextA.newPage();b=await contextB.newPage();await Promise.all([login(a,0),login(b,1)]);});
 test.afterAll(async()=>{await contextA?.close();await contextB?.close();});
 test('create and join using the real six-digit RPC invitation',async()=>{await a.goto('/#home');await a.locator('.partner-card').getByRole('button',{name:'ساختن رابطه',exact:true}).click();await a.getByRole('button',{name:'ساخت کد دعوت',exact:true}).click();const code=await a.locator('.invite-code').textContent();expect(code).toMatch(/^\d{6}$/);await a.getByRole('button',{name:'بستن',exact:true}).click();await b.goto('/#home');await b.locator('.partner-card').getByRole('button',{name:'پیوستن با کد',exact:true}).click();await b.getByLabel('کد شش‌رقمی دعوت',{exact:true}).fill(code!);await b.getByRole('dialog').getByRole('button',{name:'پیوستن با کد',exact:true}).last().click();await expect(b.getByRole('dialog')).not.toBeVisible();await expect(a.locator('.partner-connected')).toBeVisible({timeout:15000});await expect(b.locator('.partner-connected')).toBeVisible();});
 test('mood → reaction → second mood → care, without refreshing either page',async()=>{
  await a.locator('.mood-options').getByRole('button',{name:'🥱 خوابم میاد'}).click();await a.locator('.visibility-select select').selectOption('partner');await a.getByRole('button',{name:'ثبت احساس من',exact:true}).click();await expect(b.locator('.partner-card')).toContainText('خوابم میاد',{timeout:15000});
  await b.locator('.partner-card').getByRole('button',{name:'یک واکنش بفرست ❤️',exact:true}).click();await expect(a.locator('.my-reactions')).toContainText('❤️',{timeout:15000});
  await b.locator('.mood-options').getByRole('button',{name:'😊 خوشحالم'}).click();await b.locator('.visibility-select select').selectOption('partner');await b.getByRole('button',{name:'ثبت احساس من',exact:true}).click();await expect(a.locator('.partner-card')).toContainText('خوشحالم',{timeout:15000});
  await b.locator('.quick-care-card').getByRole('button',{name:'💧 آب بخور'}).click();await expect(a.locator('.care-arrival')).toContainText('آب بخور',{timeout:15000});
 });
});

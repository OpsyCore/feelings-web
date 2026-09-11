import {test,expect,type Page} from '@playwright/test';

const routes=['home','feelings','moments','care','memories','dates','calendar','diary','cycle','coupleCare','partner','profile','settings','notifications'];

async function dismissOnboarding(page:Page){
  const onboarding=page.locator('.onboarding');
  if(await onboarding.isVisible().catch(()=>false)){
    await onboarding.getByRole('button').last().click();
  }
}

test('application shell renders in Persian RTL',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('h1')).not.toBeEmpty();
});

test('all main routes render without page exceptions',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const route of routes){
    await page.goto('/#'+route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('language and theme settings change real document state',async({page})=>{
  await page.goto('/#settings');
  await dismissOnboarding(page);
  await page.locator('.settings-content').getByRole('button',{name:'تاریک',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('.settings-navigation').getByRole('button',{name:'زبان',exact:true}).click();
  await page.locator('.language-options').getByRole('button',{name:'English Left to right'}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('h1')).toHaveText('Settings');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
});

test('editor protects a typed draft',async({page})=>{
  await page.goto('/#diary');
  await dismissOnboarding(page);
  await page.locator('.page-toolbar').getByRole('button',{name:'صفحه‌ی تازه'}).click();
  await page.getByLabel('عنوان',{exact:true}).fill('یادداشت شخصی');
  await page.getByRole('button',{name:'بستن',exact:true}).click();
  await expect(page.getByText('نوشته‌ات رو کنار بذاریم؟')).toBeVisible();
  await page.getByRole('button',{name:'ادامه نوشتن'}).click();
  await expect(page.getByLabel('عنوان',{exact:true})).toHaveValue('یادداشت شخصی');
});

test('calendar moves between months',async({page})=>{
  await page.goto('/#calendar');
  await dismissOnboarding(page);
  const before=await page.locator('.calendar-head h2').textContent();
  await page.getByRole('button',{name:'بعدی',exact:true}).click();
  await expect(page.locator('.calendar-head h2')).not.toHaveText(before!);
  await page.getByRole('button',{name:'امروز',exact:true}).click();
  await expect(page.locator('.calendar-head h2')).toHaveText(before!);
});

for(const width of [360,375,390,412,430,768,1440]){
  test(`no horizontal overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for(const route of ['home','feelings','care','calendar','settings']){
      await page.goto('/#'+route);
      const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
    }
  });
}

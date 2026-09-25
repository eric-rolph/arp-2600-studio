import {test,expect} from '@playwright/test';

test('patch and tape imports open from the keyboard',async({page})=>{
 await page.goto('/');
 for(const id of ['import-patch','import-audio']){
  const chooser=page.waitForEvent('filechooser');await page.locator(`[data-file-for="${id}"]`).press('Enter');
  const file=await chooser;expect(await file.element().getAttribute('id')).toBe(id);await file.setFiles([]);
 }
});

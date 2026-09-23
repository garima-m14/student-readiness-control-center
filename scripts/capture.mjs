import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await mkdir('docs/screenshots',{recursive:true});
try{
  await page.goto('http://localhost:5174/login');
  await page.getByRole('heading',{name:'Sign in to your workspace'}).waitFor();
  await page.screenshot({path:'docs/screenshots/login.png',fullPage:true});
  await page.getByLabel('Organization',{exact:true}).fill('Acme Training');
  await page.getByLabel('Email address').fill('admin@acme.test');
  await page.getByLabel('Password',{exact:true}).fill(process.env.SEED_PASSWORD);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByText('Olivia Chen',{exact:true}).waitFor();
  await page.screenshot({path:'docs/screenshots/students.png',fullPage:true});
  await page.getByText('Olivia Chen',{exact:true}).click();
  await page.getByRole('heading',{name:'Competency evidence'}).waitFor();
  await page.screenshot({path:'docs/screenshots/detail.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://localhost:5174/students');
  await page.getByText('Olivia Chen',{exact:true}).waitFor();
  await page.screenshot({path:'docs/screenshots/mobile.png',fullPage:true});
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Mobile viewport overflows horizontally');
  if(errors.length)throw new Error(`Browser runtime errors: ${errors.join(', ')}`);
  console.log('Captured desktop, mobile and login screenshots; no browser runtime errors.');
}finally{await browser.close();}

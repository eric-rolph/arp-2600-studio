import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'browser.spec.js',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:8787',viewport:{width:1600,height:1200},launchOptions:{args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']},permissions:['microphone']}});

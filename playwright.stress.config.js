import base from './playwright.config.js';
export default {...base,testMatch:'**/*.stress.spec.js',timeout:280000};

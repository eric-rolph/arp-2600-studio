import {renderPreview} from './preset-preview-render.js';
self.onmessage=({data})=>{try{const result=renderPreview(data.entry);self.postMessage({id:data.id,...result},[result.left.buffer,result.right.buffer]);}catch(e){self.postMessage({id:data.id,error:e.message});}};

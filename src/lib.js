import { createClient } from '@supabase/supabase-js';
export const configured=Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && !import.meta.env.VITE_SUPABASE_URL.includes('YOUR-'));
export const sb=configured ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}) : null;
export const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
export const date=(v,options)=>v?new Intl.DateTimeFormat('en-IN',{month:'short',day:'numeric',year:'numeric',...options}).format(new Date(v)):'—';
export const time=v=>v?new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
export const fmtClock=s=>`${Math.floor(Math.max(0,s||0)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,s||0)%60).toString().padStart(2,'0')}`;
export const errorText=e=>e?.message||'Something went wrong. Please try again.';
export const isCore=p=>['admin','council'].includes(p?.role);
export const isAdmin=p=>p?.role==='admin';
export const fileUrl=(bucket,path)=>!path||!sb?'':sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
export async function signedUrl(bucket,path){if(!path||!sb)return '';const {data,error}=await sb.storage.from(bucket).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
export async function upload(bucket,file,user,maxMB=20){if(!file)throw Error('Select a file first.');if(file.size>maxMB*1024*1024)throw Error(`File must be smaller than ${maxMB} MB.`);if(!user?.id)throw Error('Sign in first.');const ext=(file.name.split('.').pop()||'bin').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await sb.storage.from(bucket).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(error)throw error;return path;}
export async function query(table,options={}){if(!sb)return [];let q=sb.from(table).select(options.select||'*');if(options.eq)for(const [key,val] of Object.entries(options.eq))q=q.eq(key,val);if(options.order)q=q.order(options.order,{ascending:options.asc??false});if(options.limit)q=q.limit(options.limit);const {data,error}=await q;if(error)throw error;return data||[];}
export async function save(table,record){const {data,error}=await sb.from(table).insert(record).select().single();if(error)throw error;return data;}
export async function patch(table,id,record){const {data,error}=await sb.from(table).update(record).eq('id',id).select().single();if(error)throw error;return data;}
export function getPostImages(post){
    if(!post)return [];
    if(Array.isArray(post.images)&&post.images.length>0){
        return post.images.map(img=>typeof img==='string'?{path:img,caption:''}:{path:img.path||'',caption:img.caption||''}).filter(img=>Boolean(img.path));
    }
    if(post.body&&post.body.includes('<!--kiducatchis_images:')){
        try{
            const m=post.body.match(/<!--kiducatchis_images:(.*?)-->/s);
            if(m&&m[1]){
                const parsed=JSON.parse(m[1]);
                if(Array.isArray(parsed)&&parsed.length){
                    return parsed.map(img=>typeof img==='string'?{path:img,caption:''}:{path:img.path||'',caption:img.caption||''}).filter(img=>Boolean(img.path));
                }
            }
        }catch(_){}
    }
    if(post.image_path){
        return [{path:post.image_path,caption:''}];
    }
    return [];
}
export function getCleanPostBody(body){
    if(!body)return '';
    return body.replace(/<!--kiducatchis_images:.*?-->/gs,'').trim();
}
export function getYouTubeEmbedUrl(url){
    if(!url)return null;
    try{
        const u=new URL(url);
        if(u.hostname.includes('youtube.com')){
            const v=u.searchParams.get('v');
            if(v)return `https://www.youtube-nocookie.com/embed/${v}`;
            if(u.pathname.startsWith('/shorts/')){
                const id=u.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
                if(id)return `https://www.youtube-nocookie.com/embed/${id}`;
            }
            if(u.pathname.startsWith('/embed/'))return url;
        }
        if(u.hostname==='youtu.be'){
            const id=u.pathname.replace(/^\//,'').split('?')[0];
            if(id)return `https://www.youtube-nocookie.com/embed/${id}`;
        }
    }catch(_){}
    return null;
}
export function getVimeoEmbedUrl(url){
    if(!url)return null;
    try{
        const u=new URL(url);
        if(u.hostname.includes('vimeo.com')){
            const id=u.pathname.split('/').filter(Boolean)[0];
            if(id&&/^\d+$/.test(id))return `https://player.vimeo.com/video/${id}`;
        }
    }catch(_){}
    return null;
}



import type {Locale} from './locales';
const labels:Record<Locale,[string,string]>={
 'zh-Hans':['海岸线','林间山丘'], 'zh-Hant':['海岸線','林間山丘'],
 en:['Coastline','Woodland hills'],ja:['海岸線','森の丘'],ko:['해안선','숲속 언덕'],es:['Costa','Colinas del bosque']
};
export const desktopPhotos=['/desktop/coastline.jpg','/desktop/sonoma-horizon.jpg'];
export function desktopFiles(locale:Locale){return labels[locale].map((label,index)=>({label,filename:`${label}.jpg`,src:desktopPhotos[index]}))}

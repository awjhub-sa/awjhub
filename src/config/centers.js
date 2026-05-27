import { isDemoActive, DEMO_CENTERS } from '../lib/demoData.js';

const _REAL_CENTERS = [
  { id: 'مركز 5',    caterer: 'مطابخ نعيمة ادريس صالح نوح' },
  { id: 'مركز 7',    caterer: 'مؤسسة شعاع الشروق المتميزة لتقديم الوجبات' },
  { id: 'مركز 8',    caterer: 'مؤسسة شعاع الشروق المتميزة لتقديم الوجبات' },
  { id: 'مركز 20',   caterer: 'مؤسسة صفوة النعم لخدمات الاعاشة' },
  { id: 'مركز 21',   caterer: 'شركة مطاعم ومطابخ المضياف العربي' },
  { id: 'مركز 22',   caterer: 'شركة مطبخ مدى سحيم الكعبي لتقديم الوجبات' },
  { id: 'مركز 23',   caterer: 'مؤسسة اسامة محمد العيدروس لخدمات الاعاشة' },
  { id: 'مركز 24',   caterer: 'شركة إكرام لخدمات الاعاشة' },
  { id: 'مركز 25-أ', caterer: 'مؤسسة ارض الجمان لاخدمات الاعاشة' },
  { id: 'مركز 25-ب', caterer: 'شركة امجاد العماد' },
  { id: 'مركز 26',   caterer: 'شركة انفال قريش لخدمات الاعاشة' },
  { id: 'مركز 30',   caterer: 'شركة مطبخ رسيل لاعاشة والتموين شخص واحد' },
  { id: 'مركز 31',   caterer: 'شركة مطابخ الشعلة لخدمات الاعاشة' },
  { id: 'مركز 32',   caterer: 'شركة رباعيات الشيف لخدمات الاعاشة قابضة' },
  { id: 'مركز 33',   caterer: 'شركة رباعيات الشيف لخدمات الاعاشة قابضة' },
  { id: 'مركز 34',   caterer: 'شركة الاسناد الماسي لخدمات الاعاشة' },
  { id: 'مركز 35',   caterer: 'مؤسسة الإسناد المتميز لخدمات الاعاشة' },
  { id: 'مركز 40',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 41',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 42',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 43',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 44',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 45',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 46',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 47',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 48',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 49',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 50',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 51',   caterer: 'شركة تقنيات الغذاء المتحدة للتصنيع' },
  { id: 'مركز 60',   caterer: 'شركة حنان سماعي عبدالرحمن لخدمات الاعاشة' },
  { id: 'مركز 61',   caterer: 'شركة الضيافة العربية لخدمات الاعاشة' },
  { id: 'مركز 62',   caterer: 'شركة مطابخ كنان العربية لتقديم الوجبات' },
  { id: 'مركز 63',   caterer: 'شركة رونق الطهي' },
  { id: 'مركز 64',   caterer: 'شركة الشركاء المتحدة لخدمات الإعاشة' },
  { id: 'مركز 65',   caterer: 'شركة معالم اسيا الذهبية لخدمات الإعاشة' },
  { id: 'مركز 66',   caterer: 'شركة أكارم البيت لخدمات الاعاشة' },
  { id: 'مركز 67',   caterer: 'مؤسسة زاد التميز لخدمات الاعاشة' },
  { id: 'مركز 68',   caterer: 'شركة النور النكهات لخدمات الاعاشة' },
  { id: 'مركز 69',   caterer: 'شركة غرس المتكاملة للخدمات الغذائية' },
  { id: 'مركز 70',   caterer: 'شركة تموين الملبي لخدمات الاعاشة' },
  { id: 'مركز 71',   caterer: 'مطابخ مدى الضيافه لتقديم الوجبات' },
  { id: 'مركز 72',   caterer: 'شركة نمور الاطعمة المحدودة' },
  { id: 'مركز 73',   caterer: 'مؤسسة اطعمة الرواد لخدمات الاعاشة' },
  { id: 'مركز 74',   caterer: 'موسسة ممدوح عبدالعزيز بن إبراهيم دمنهوري لخدمات الاعاشة' },
  { id: 'مركز 75',   caterer: 'شركة الطباخ الماهر لخدمات الاعاشة' },
  { id: 'مركز 76',   caterer: 'شركة قطرات ندى المحدودة' },
  { id: 'مركز 77',   caterer: 'شركة الفن الغذائي لخدمات الاعاشة' },
  { id: 'مركز 78',   caterer: 'شركة رواد الزاد لخدمات الاعاشة' },
  { id: 'مركز 79',   caterer: 'شركة رواد الزاد لخدمات الاعاشة' },
  { id: 'مركز 80',   caterer: 'شركه زاد العماد المحدوده' },
  { id: 'مركز 81',   caterer: 'شركة اسيان الماسية لخدمات الإعاشة' },
  { id: 'مركز 82',   caterer: 'شركة الرغائب المتطورة لخدمات الاعاشة' },
  { id: 'مركز 83',   caterer: 'شركة اذواق الخير لخدمات الاعاشة' },
  { id: 'مركز 84',   caterer: 'رغيد بشناق للاستثمار' },
  { id: 'مركز 85',   caterer: 'شركة الميرة الفضية لخدمات الإعاشة' },
  { id: 'مركز 86',   caterer: 'شركة نبيل صالح محجوب لخدمات الإعاشة شركة شخص واحد' },
  { id: 'مركز 87',   caterer: 'مؤسسة منابر الإمداد' },
  { id: 'مركز 88',   caterer: 'شركة روافد منى لخدمات الاعاشة' },
  { id: 'مركز 89',   caterer: 'شركة سبل المتحدة لخدمات الإعاشة' },
  { id: 'مركز 90',   caterer: 'شركة رفاد الحجاز لخدمات الاعاشة' },
  { id: 'مركز 99',   caterer: 'شركة حلوى الكافي لخدمات الاعاشة' },
  { id: 'مركز 101',  caterer: 'مؤسسة سفير الطهاة لخدمات الاعاشة' },
  { id: 'مركز 102',  caterer: 'مؤسسة مطبخ رفادة الضيف لتقديم الوجبات' },
];

/* Proxy that swaps between real and demo centers based on runtime demo flag.
 * Importers keep using `CENTERS` exactly like a normal array. */
export const CENTERS = new Proxy(_REAL_CENTERS, {
  get(target, prop) {
    const arr = isDemoActive() ? DEMO_CENTERS : target;
    const v = arr[prop];
    return typeof v === 'function' ? v.bind(arr) : v;
  },
  has(target, prop) {
    const arr = isDemoActive() ? DEMO_CENTERS : target;
    return prop in arr;
  },
  ownKeys(target) {
    return Reflect.ownKeys(isDemoActive() ? DEMO_CENTERS : target);
  },
  getOwnPropertyDescriptor(target, prop) {
    const arr = isDemoActive() ? DEMO_CENTERS : target;
    return Object.getOwnPropertyDescriptor(arr, prop);
  },
});

export const getCaterer = (centerId) =>
  CENTERS.find(c => c.id === centerId)?.caterer || '';


const SHAKHIS = {
  5:   '10/56',   7:   '12/56',   8:   '6/510',
  20:  '3/210',   21:  '11/210',  22:  '37/68',
  23:  '39/68',   24:  '9/210',   25:  '2/212',
  26:  '59/68',   30:  '4/634',   31:  '6/631',
  32:  '3/633',   33:  '2/634',   34:  '8/631',
  35:  '4/631',   40:  '21/56',   41:  '24/62',
  42:  '7/56',    43:  '12/62',   44:  '13/56',
  45:  '20/62',   46:  '9/56',    47:  '17/56',
  48:  '8/641',   49:  '10/62',   50:  '16/62',
  51:  '16/643',  60:  '2/616',   61:  '7/620',
  62:  '6/622',   63:  '4/622',   64:  '1/620',
  65:  '12/614',  66:  '11/612',  67:  '8/614',
  68:  '7/612',   69:  '5/612',   70:  '2/614',
  71:  '1/612',   72:  '15-613',  73:  '13/613',
  74:  '1-604',   75:  '3-604',   76:  '1/604',
  77:  '9/613',   78:  '4/604',   79:  '2/604',
  80:  '6/611',   81:  '1/602',   82:  '7/613',
  83:  '1/618',   84:  '4/620',   85:  '5/618',
  86:  '8/620',   87:  '3/608',   88:  '2/542',
  89:  '4/547',   90:  '2/547',   99:  '44/50',
  101: '6/524',   102: '84/68',
};

export const getShakhis = (centerId) => {
  const num = parseInt(String(centerId || '').replace(/[^0-9]/g, ''));
  return SHAKHIS[num] || null;
};


const LOCATIONS = {
  'مركز 5':    'https://www.google.com/maps/search/21.411943,+39.886138?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=33bd6264-2674-4cb8-a809-d9783381d55e',
  'مركز 7':    'https://www.google.com/maps/search/21.411943,+39.886138?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=33bd6264-2674-4cb8-a809-d9783381d55e',
  'مركز 8':    'https://www.google.com/maps/place/MINA5162/@21.4060057,39.8996585,287m/data=!3m1!1e3!4m6!3m5!1s0x15c2041d68e3ffe9:0xa6bb3e0baf4f2814!8m2!3d21.4057989!4d39.898264!16s%2Fg%2F11v0gt2ybt',
  'مركز 20':   'https://www.google.com/maps/place/%D9%85%D8%AE%D9%8A%D9%85+%D8%AD%D8%AC%D8%A7%D8%AC+%D9%88%D9%83%D8%A7%D9%84%D8%A9+%D8%A7%D9%84%D8%AD%D8%AC%D8%B1+%D8%A7%D9%84%D8%A7%D8%B3%D9%88%D8%AF%E2%80%AD/@21.4196306,39.8860583,257m/data=!3m1!1e3!4m6!3m5!1s0x15c2050014100855:0x9d64cdc4dd59b194!8m2!3d21.4194654!4d39.8854234!16s%2Fg%2F11w1ffllm2',
  'مركز 21':   'https://www.google.com/maps/place/%D9%85%D8%B4%D8%B9%D8%B1+%D9%85%D9%86%D9%89-%D9%85%D8%A8%D8%B1%D8%AF+%D9%85%D9%8A%D8%A7%D9%87%E2%80%AD/@21.4187808,39.886671,144m/data=!3m1!1e3!4m6!3m5!1s0x15c20409ad17a3b3:0xadaa7d68532d4c08!8m2!3d21.4186079!4d39.8861068!16s%2Fg%2F11xgf8k78d',
  'مركز 22':   'https://www.google.com/maps/place/MINA2112/@21.4180246,39.8872866,121m/data=!3m1!1e3!4m6!3m5!1s0x15c20408587d164f:0x8e54d7566faaa169!8m2!3d21.417853!4d39.887026!16s%2Fg%2F11v0gs080b',
  'مركز 23':   'https://www.google.com/maps/place/MINA2111/@21.4172961,39.8888293,406m/data=!3m1!1e3!4m6!3m5!1s0x15c20408914fca67:0x5b77942166a63920!8m2!3d21.4168377!4d39.8877242!16s%2Fg%2F11v0gsnyvb',
  'مركز 24':   'https://www.google.com/maps/place/MINA2211/@21.4191444,39.8867039,242m/data=!3m1!1e3!4m6!3m5!1s0x15c20409b1fb616b:0x8a71309ec2d0b627!8m2!3d21.4187262!4d39.8859279!16s%2Fg%2F11v0grpvy0',
  'مركز 25-أ': 'https://maps.app.goo.gl/fizToKAaC6WkHLk7A',
  'مركز 25-ب': 'https://www.google.com/maps/place/MINA6011/@21.4126866,39.8984342,203m/data=!3m1!1e3!4m6!3m5!1s0x15c20401f1a0ee5d:0x9adfe0655af9fe00!8m2!3d21.412673!4d39.8981769!16s%2Fg%2F11sv5cm8ct',
  'مركز 26':   'https://www.google.com/maps/place/MEMC3409%D8%8C+3409+%D8%B4%D8%A7%D8%B1%D8%B9+634%D8%8C+7221%D8%8C+%D8%AD%D9%8A+%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B9%D8%B1%D8%8C+%D9%85%D9%83%D8%A9+24248%E2%80%AD/@21.4220953,39.8967423,194m/data=!3m1!1e3!4m6!3m5!1s0x15c203fe7b98f9a9:0x8b05bbe474faff72!8m2!3d21.4220105!4d39.8968731!16s%2Fg%2F11wb2yy4t8',
  'مركز 30':   'https://www.google.com/maps/search/21.425107,+39.896433?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=700c4f44-352e-48e6-a194-811ed853ce22',
  'مركز 31':   'https://www.google.com/maps/search/21.425466,+39.897547?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=c4220827-d381-448e-a159-8d664144bf79',
  'مركز 32':   'https://www.google.com/maps/search/21.422001,+39.896485?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=c5bd3138-650a-4bee-94b6-fbd2fda4907a',
  'مركز 33':   'https://www.google.com/maps/search/21.426214,+39.896593?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=c7500457-0b52-4d29-8df0-65118efb893b',
  'مركز 34':   'https://www.google.com/maps/place/MEMB7524,+7524+Street+631,+3350%D8%8C+%D8%AD%D9%8A+%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B9%D8%B1%D8%8C+Makkah+24248%E2%80%AD/@21.4246552,39.8972687,358m/data=!3m1!1e3!4m6!3m5!1s0x15c203fc525f4b01:0x9f595cbad3c3855b!8m2!3d21.4245512!4d39.8963127!16s%2Fg%2F11c29z0p8z',
  'مركز 35':   'https://www.google.com/maps/place/%D9%85%D8%AE%D9%8A%D9%85+%D9%A1%D9%A1%D9%A0+%D9%85%D9%86%D9%89%E2%80%AD/@21.4122572,39.8870487,171m/data=!3m1!1e3!4m6!3m5!1s0x15c2040fb59cf21d:0x140d094543018875!8m2!3d21.4118655!4d39.8864013!16s%2Fg%2F11v0grx22j',
  'مركز 40':   'https://www.google.com/maps/search/21.412731,+39.886683?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=5ecc1596-8699-4d88-ab25-8b6e26a175ae',
  'مركز 41':   'https://www.google.com/maps/place/MINA2504/@21.4143015,39.884172,144m/data=!3m1!1e3!4m6!3m5!1s0x15c2040e81f17049:0x2a70700e7434af7c!8m2!3d21.414136!4d39.883682!16s%2Fg%2F11kpy7c04q',
  'مركز 42':   'https://www.google.com/maps/place/12%2F62+%D9%85%D8%B1%D9%83%D8%B2+%D8%B6%D9%8A%D8%A7%D9%81%D8%A9+104+%D9%84%D8%AD%D8%AC%D8%A7%D8%AC+%D8%A7%D9%84%D8%B9%D8%B1%D8%A7%D9%82%E2%80%AD/@21.4146939,39.8848092,121m/data=!3m1!1e3!4m6!3m5!1s0x15c2052a25149c71:0x21b6652638bfe6d9!8m2!3d21.4148994!4d39.8846431!16s%2Fg%2F11vzxwtmyy',
  'مركز 43':   'https://www.google.com/maps/search/21.413483,+39.885843?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=e00559f8-1c5f-4191-b5a5-308e0e80a687',
  'مركز 44':   'https://www.google.com/maps/place/Mina+20%2F62+M12%2F809/@21.4129291,39.8863259,121m/data=!3m1!1e3!4m6!3m5!1s0x15c205ce4a28a985:0xd47b551d6b834538!8m2!3d21.4130435!4d39.8859875!16s%2Fg%2F11v12_hdll',
  'مركز 45':   'https://www.google.com/maps/place/MINA2503/@21.4143034,39.8853231,171m/data=!3m1!1e3!4m6!3m5!1s0x15c2040ebc71bb5b:0x4f2a6138fb0d8b59!8m2!3d21.4145625!4d39.8850343!16s%2Fg%2F11kpy70lhk',
  'مركز 46':   'https://www.google.com/maps/search/21.413051,+39.886243?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=e3783ce1-bfac-41c3-9bae-381a820b8220',
  'مركز 47':   'https://www.google.com/maps/place/MINA2511/@21.4154258,39.8841436,121m/data=!3m1!1e3!4m6!3m5!1s0x15c2040c0197a303:0xc393620542e82ceb!8m2!3d21.4157183!4d39.8839124!16s%2Fg%2F11kpy6k_7m',
  'مركز 48':   'https://www.google.com/maps/place/MINA2511/@21.4154258,39.8841436,121m/data=!3m1!1e3!4m6!3m5!1s0x15c2040c0197a303:0xc393620542e82ceb!8m2!3d21.4157183!4d39.8839124!16s%2Fg%2F11kpy6k_7m',
  'مركز 49':   'https://www.google.com/maps/place/%D9%85%D9%88%D9%82%D8%B9+%D8%A7%D9%84%D8%AA%D8%AE%D9%8A%D9%8A%D9%85-16%2F62%E2%80%AD/@21.4140793,39.8853376,129m/data=!3m1!1e3!4m6!3m5!1s0x15c2040ef34d020d:0x1258477c225a3c8e!8m2!3d21.4138597!4d39.8849187!16s%2Fg%2F11yd84dvhl',
  'مركز 50':   'https://www.google.com/maps?q=21.4253632,39.9011442&z=17&hl=ar',
  'مركز 51':   'https://www.google.com/maps/search/21.418714,+39.895073?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=f9b6c48a-8454-4068-98f9-9524e21267b4',
  'مركز 60':   'https://www.google.com/maps/place/Tenda+Jamaah+Haji+Indonesia/@21.4194734,39.8960726,518m/data=!3m1!1e3!4m6!3m5!1s0x15c203ff401b8db1:0xbe1ad812253f0f11!8m2!3d21.419175!4d39.89517!16s%2Fg%2F11f3jv77td',
  'مركز 61':   'https://www.google.com/maps/place/%D8%AD%D9%85%D8%A7%D9%85+%D8%B9%D8%A7%D9%85%E2%80%AD/@21.4194734,39.8960726,518m/data=!3m1!1e3!4m6!3m5!1s0x15c203ff3b75c7ab:0x536a61b9da767756!8m2!3d21.4198!4d39.8948061!16s%2Fg%2F11xg52xcb9',
  'مركز 62':   'https://www.google.com/maps/search/21.420371,+39.894948?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=4b531c0d-d0fb-479f-b91d-fb54f1245964',
  'مركز 63':   'https://www.google.com/maps/place/MEMC7069%D8%8C+7069+%D8%B4%D8%A7%D8%B1%D8%B9+620%D8%8C+3180%D8%8C+%D8%AD%D9%8A+%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B9%D8%B1%D8%8C+%D9%85%D9%83%D8%A9+24248%E2%80%AD/@21.4198151,39.8964708,518m/data=!3m1!1e3!4m6!3m5!1s0x15c203fed88c3483:0x7c6a5093748f80bc!8m2!3d21.4206454!4d39.8947396!16s%2Fg%2F11y21x1s_4',
  'مركز 64':   'https://www.google.com/maps?q=21.421706,39.8951391&z=17&hl=ar',
  'مركز 65':   'https://www.google.com/maps?q=21.4218227,39.8938213&z=17&hl=ar',
  'مركز 66':   'https://www.google.com/maps?q=21.4223562,39.8951106&z=17&hl=ar',
  'مركز 67':   'https://www.google.com/maps?q=21.4226252,39.8937169&z=17&hl=ar',
  'مركز 68':   'https://www.google.com/maps?q=21.4229816,39.8937131&z=17&hl=ar',
  'مركز 69':   'https://www.google.com/maps?q=21.4232907,39.8950083&z=17&hl=ar',
  'مركز 70':   'https://www.google.com/maps?q=21.4235157,39.8936266&z=17&hl=ar',
  'مركز 71':   'https://www.google.com/maps?q=21.4240476,39.8952386&z=17&hl=ar',
  'مركز 72':   'https://www.google.com/maps?q=21.4246652,39.895147&z=17&hl=ar',
  'مركز 73':   'https://www.google.com/maps?q=21.4250937,39.8948001&z=17&hl=ar',
  'مركز 74':   'https://www.google.com/maps?q=21.4263275,39.8949735&z=17&hl=ar',
  'مركز 75':   'https://www.google.com/maps?q=21.4265208,39.894944&z=17&hl=ar',
  'مركز 76':   'https://www.google.com/maps?q=21.4253665,39.8942629&z=17&hl=ar',
  'مركز 77':   'https://www.google.com/maps?q=21.4258543,39.8948748&z=17&hl=ar',
  'مركز 78':   'https://www.google.com/maps?q=21.4262381,39.8948724&z=17&hl=ar',
  'مركز 79':   'https://www.google.com/maps?q=21.426669,39.89379&z=17&hl=ar',
  'مركز 80':   'https://www.google.com/maps?q=21.4257728,39.8932096&z=17&hl=ar',
  'مركز 81':   'https://www.google.com/maps?q=21.4252872,39.8935551&z=17&hl=ar',
  'مركز 82':   'https://www.google.com/maps/place/CVCV%2B4FR%D8%8C+%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B9%D8%B1%D8%8C+%D9%85%D9%83%D8%A9+24248%E2%80%AD/@21.4199918,39.8943771,218m/data=!3m1!1e3!4m6!3m5!1s0x15c203f8cdf8bc7d:0x54360adf11f07e15!8m2!3d21.4202445!4d39.8936258!16s%2Fg%2F11vsjpbtzz',
  'مركز 83':   'https://www.google.com/maps/place/%D9%85%D9%88%D9%82%D8%B9+%D8%A7%D9%84%D8%AA%D8%AE%D9%8A%D9%8A%D9%85-4%2F620%E2%80%AD/@21.4197473,39.8944329,218m/data=!3m1!1e3!4m6!3m5!1s0x15c203f8b5e906ff:0xe90525a8828d5b01!8m2!3d21.4195959!4d39.8936377!16s%2Fg%2F11xdt04yz7',
  'مركز 84':   'https://www.google.com/maps/search/21.419193,+39.893793?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=24569908-b35f-4b37-8c9a-f21ce8e1b82f',
  'مركز 85':   'https://www.google.com/maps/search/21.418750,+39.893953?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=d61bb407-9c61-4036-8b0d-5c9689c46498',
  'مركز 86':   'https://www.google.com/maps/search/21.418340,+39.893781?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=fd193fdf-93ff-4664-b290-3057dd4235a0',
  'مركز 87':   'https://www.google.com/maps/place/%D8%AD%D9%85%D8%A7%D9%85+%D8%B9%D8%A7%D9%85%E2%80%AD/@21.4100674,39.9054658,218m/data=!3m1!1e3!4m6!3m5!1s0x15c206aea7d84f1f:0x5a1ca257e5522557!8m2!3d21.4102018!4d39.9048379!16s%2Fg%2F11ycm3c7pz',
  'مركز 88':   'https://www.google.com/maps/search/21.409632,+39.905446?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=412c5b32-1728-4b81-b562-3b96b0958589',
  'مركز 89':   'https://www.google.com/maps/search/21.409968,+39.905883?entry=tts&g_ep=EgoyMDI2MDIyNS4wIPu8ASoASAFQAw%3D%3D&skid=4776bb43-4701-492c-b0d8-d490d0c6db78',
  'مركز 90':   'https://www.google.com/maps/search/21.407489,+39.889537?entry=tts&g_ep=EgoyMDI2MDMxNS4wIPu8ASoASAFQAw%3D%3D&skid=114f0414-936f-42ed-94e0-2f08c00bf353',
  'مركز 99':   'https://maps.app.goo.gl/dtZhHjiWAWXSnwKQA?g_st=aw',
  'مركز 101':  'https://maps.app.goo.gl/emAKXvTvXqHXHRWc8?g_st=aw',
};

export const getLocation = (centerId) => LOCATIONS[centerId] || null;

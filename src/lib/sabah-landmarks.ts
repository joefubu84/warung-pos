// High-Precision Sabah GIS & Landmark Database with Nearest Landmark Detection
// Specially tuned for Penampang, Donggongon, Kota Kinabalu, and surrounding Sabah areas

export interface SabahLocationItem {
  name: string;
  lat: number;
  lng: number;
  desc: string;
  category: 'hotel' | 'apartment' | 'shoplot' | 'housing' | 'landmark';
}

export const LOCAL_SABAH_LANDMARKS: SabahLocationItem[] = [
  // ==========================================
  // 0. WARUNG JNJ & KEY PENAMPANG HUBS
  // ==========================================
  { name: 'Warung JNJ Penampang', lat: 5.9284153, lng: 116.1146463, desc: 'a17, Jln Datuk Panglima Banting, Penampang', category: 'shoplot' },
  { name: 'Padimas Point Commercial Centre', lat: 5.9142, lng: 116.0856, desc: 'Lorong Padimas, Donggongon, Penampang', category: 'shoplot' },
  { name: 'Mari Mari Steamboat Buffet, Padimas Point', lat: 5.9140, lng: 116.0852, desc: 'Lorong Padimas, Penampang', category: 'shoplot' },
  { name: 'Niyocha Matcha, Padimas Point', lat: 5.9143, lng: 116.0857, desc: 'Padimas Point, Penampang', category: 'shoplot' },
  { name: 'Plaza 333 Kobusak Commercial', lat: 5.9320, lng: 116.0880, desc: 'Jalan Pintas Penampang', category: 'shoplot' },
  { name: 'Grand Millennium Plaza', lat: 5.9340, lng: 116.0890, desc: 'Kobusak, Penampang', category: 'shoplot' },
  { name: 'Pintas Avenue Commercial', lat: 5.9360, lng: 116.0830, desc: 'Jalan Pintas, Penampang', category: 'shoplot' },
  { name: 'ITCC Shopping Mall & Manhattan Suites', lat: 5.9225, lng: 116.0915, desc: 'Jalan Pintas Penampang', category: 'shoplot' },
  { name: 'Megalong Shopping Mall', lat: 5.9090, lng: 116.1025, desc: 'Pekan Donggongon, Penampang', category: 'shoplot' },
  { name: 'Donggongon Town / Pekan Donggongon Shoplots', lat: 5.9085, lng: 116.1015, desc: 'Pekan Donggongon, Penampang', category: 'shoplot' },
  { name: 'Bundusan Commercial Centre', lat: 5.9450, lng: 116.1080, desc: 'Jalan Bundusan, Penampang', category: 'shoplot' },
  { name: 'Pavilion Bundusan / T1 Bundusan', lat: 5.9430, lng: 116.1050, desc: 'Bundusan, Penampang', category: 'shoplot' },
  { name: 'Taman Formosa Commercial', lat: 5.9470, lng: 116.1020, desc: 'Bundusan, Penampang', category: 'shoplot' },
  { name: 'Metro Town Commercial Centre', lat: 5.9670, lng: 116.1080, desc: 'Jalan Kolombong / Lintas', category: 'shoplot' },
  { name: '88 Marketplace Kepayan', lat: 5.9420, lng: 116.0720, desc: 'Lorong 88 Marketplace, Kepayan Ridge', category: 'shoplot' },
  { name: 'Lido Plaza & Lido Commercial', lat: 5.9480, lng: 116.0820, desc: 'Jalan Penampang / Lintas, Luyang', category: 'shoplot' },
  { name: 'Lintas Plaza & Lintas Square', lat: 5.9570, lng: 116.0890, desc: 'Lintas, Luyang', category: 'shoplot' },
  { name: 'Heritage Plaza Lintas', lat: 5.9580, lng: 116.0880, desc: 'Lintas, Luyang', category: 'shoplot' },
  { name: 'City Mall Shopping Centre', lat: 5.9640, lng: 116.1020, desc: 'Jalan Lintas, Luyang', category: 'shoplot' },
  { name: 'Damai Plaza & Damai Point', lat: 5.9670, lng: 116.0930, desc: 'Damai, Luyang', category: 'shoplot' },
  { name: 'Foh Sang Commercial Centre', lat: 5.9550, lng: 116.0910, desc: 'Luyang, KK', category: 'shoplot' },
  { name: 'Inanam Taipan Commercial Centre', lat: 5.9920, lng: 116.1320, desc: 'Inanam, KK', category: 'shoplot' },
  { name: 'Inanam Capital Commercial Centre', lat: 5.9940, lng: 116.1350, desc: 'Inanam, KK', category: 'shoplot' },
  { name: 'Inanam Business Centre', lat: 5.9915, lng: 116.1310, desc: 'Pekan Inanam, KK', category: 'shoplot' },
  { name: 'Kolombong BDC Industrial Estate', lat: 5.9810, lng: 116.1150, desc: 'Kolombong, KK', category: 'shoplot' },
  { name: 'Alamesra Plaza Utama / Plaza Permai', lat: 6.0280, lng: 116.1240, desc: 'Jalan Sulaman, KK', category: 'shoplot' },
  { name: 'Menggatal Plaza Commercial', lat: 6.0220, lng: 116.1550, desc: 'Menggatal, KK', category: 'shoplot' },
  { name: 'Pekan Putatan / Servay Shoplots', lat: 5.8920, lng: 116.0520, desc: 'Putatan', category: 'shoplot' },
  { name: 'Royal Plaza Putatan', lat: 5.8940, lng: 116.0530, desc: 'Pekan Putatan', category: 'shoplot' },
  { name: 'Palm Square Commercial Kinarut', lat: 5.8210, lng: 116.0380, desc: 'Kinarut, Papar', category: 'shoplot' },

  // ==========================================
  // 1. SHOPPING MALLS & CITY CENTRES
  // ==========================================
  { name: 'Imago Shopping Mall', lat: 5.9710, lng: 116.0670, desc: 'KK Times Square, KK', category: 'shoplot' },
  { name: 'Suria Sabah Shopping Mall', lat: 5.9860, lng: 116.0770, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: 'Centre Point Sabah', lat: 5.9790, lng: 116.0720, desc: 'KK Bandar', category: 'shoplot' },
  { name: 'Api-Api Centre Commercial', lat: 5.9750, lng: 116.0710, desc: 'Jalan Centre Point, KK', category: 'shoplot' },
  { name: 'Wisma Merdeka / Segama', lat: 5.9840, lng: 116.0750, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: 'Karamunsing Complex / Capital', lat: 5.9710, lng: 116.0770, desc: 'Karamunsing, KK', category: 'shoplot' },
  { name: 'Gaya Street Shoplots', lat: 5.9860, lng: 116.0770, desc: 'Kota Kinabalu City', category: 'shoplot' },
  { name: 'Sinsuran Commercial Centre', lat: 5.9800, lng: 116.0730, desc: 'KK Waterfront', category: 'shoplot' },
  { name: 'Kampung Air Commercial', lat: 5.9770, lng: 116.0760, desc: 'Pusat Bandar KK', category: 'shoplot' },
  { name: '1Borneo Hypermall', lat: 6.0360, lng: 116.1280, desc: 'Jalan Sulaman, Kota Kinabalu', category: 'shoplot' },

  // ==========================================
  // 2. APARTMENTS, CONDOS & RESIDENCES
  // ==========================================
  { name: 'Cyber City Apartment Phase 1', lat: 5.9210, lng: 116.0790, desc: 'Kepayan / Penampang', category: 'apartment' },
  { name: 'Cyber City Apartment Phase 2', lat: 5.9230, lng: 116.0810, desc: 'Kepayan / Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 1', lat: 5.9470, lng: 116.1100, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 2', lat: 5.9480, lng: 116.1110, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 3', lat: 5.9490, lng: 116.1120, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 4', lat: 5.9485, lng: 116.1105, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Beverly Hills Apartment Phase 5', lat: 5.9500, lng: 116.1130, desc: 'Jalan Bundusan, Penampang', category: 'apartment' },
  { name: 'Putatan Platinum Apartment', lat: 5.8950, lng: 116.0550, desc: 'Putatan, Penampang', category: 'apartment' },
  { name: 'The Loft Residences @ Imago', lat: 5.9715, lng: 116.0675, desc: 'KK Times Square, KK', category: 'apartment' },
  { name: 'Sutera Avenue Residences & SOVO', lat: 5.9680, lng: 116.0660, desc: 'Jalan Coastal, KK', category: 'apartment' },
  { name: 'Riverson SOHO & The Walk', lat: 5.9695, lng: 116.0645, desc: 'Off Jalan Coastal, KK', category: 'apartment' },
  { name: 'Aeropod SOVO & Commercial', lat: 5.9470, lng: 116.0610, desc: 'Tanjung Aru, KK', category: 'apartment' },
  { name: 'Jesselton Residences & Mall', lat: 5.9890, lng: 116.0790, desc: 'Jalan Haji Saman, KK City', category: 'apartment' },
  { name: 'Jesselton Quay (JQ Central)', lat: 5.9910, lng: 116.0810, desc: 'Jesselton Waterfront, KK', category: 'apartment' },
  { name: 'University Apartment Phase 1 (UA 1)', lat: 6.0410, lng: 116.1330, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'University Apartment Phase 2 (UA 2)', lat: 6.0430, lng: 116.1350, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'University Condominium Pelangi (UCP)', lat: 6.0390, lng: 116.1380, desc: 'Jalan Sulaman, Menggatal', category: 'apartment' },
  { name: 'Country Heights Apartment', lat: 5.9280, lng: 116.1280, desc: 'Minintod, Penampang', category: 'apartment' },
  { name: 'Nountun Apartment', lat: 5.9890, lng: 116.1280, desc: 'Inanam, KK', category: 'apartment' },
  { name: 'Kingfisher Sandpiper Condominium', lat: 5.9980, lng: 116.1420, desc: 'Jalan Kionsom, Inanam', category: 'apartment' },
  { name: 'Maya Condominium Likas', lat: 5.9870, lng: 116.0980, desc: 'Jalan Likas, KK', category: 'apartment' },
  { name: 'Likas Court Condominium', lat: 5.9890, lng: 116.1050, desc: 'Jalan Tuaran, Likas', category: 'apartment' },
  { name: 'Radiant Tower & Radiant Court', lat: 5.9920, lng: 116.0990, desc: 'Signal Hill / Likas', category: 'apartment' },
  { name: 'Bayshore Condominium', lat: 5.9930, lng: 116.0960, desc: 'Signal Hill, KK', category: 'apartment' },
  { name: 'Ashton Tower Kolombong', lat: 5.9760, lng: 116.1240, desc: 'Jalan Nountun, Kolombong', category: 'apartment' },
  { name: 'V21 Residence Sepanggar', lat: 6.0710, lng: 116.1480, desc: 'Sepanggar / KKIP', category: 'apartment' },
  { name: 'Puncak Menggatal Condominium', lat: 6.0180, lng: 116.1620, desc: 'Menggatal, KK', category: 'apartment' },
  { name: 'Telipok Ria Apartment', lat: 6.0820, lng: 116.1820, desc: 'Telipok, Menggatal', category: 'apartment' },
  { name: 'Pelita Court Apartment', lat: 5.9450, lng: 116.0750, desc: 'Kepayan, KK', category: 'apartment' },

  // ==========================================
  // 3. HOUSING ESTATES & LANDED TAMANS
  // ==========================================
  { name: 'Taman Liana Phase 2, Penampang', lat: 5.9135, lng: 116.0868, desc: 'Jalan Taman Liana, Donggongon / Penampang', category: 'housing' },
  { name: 'Taman Liana Phase 1, Penampang', lat: 5.9130, lng: 116.0845, desc: 'Donggongon / Penampang', category: 'housing' },
  { name: 'Taman Penampang Phase 1 & 2', lat: 5.9260, lng: 116.0980, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Suria Penampang', lat: 5.9270, lng: 116.1010, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Towering Penampang', lat: 5.9370, lng: 116.0950, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Kasigui 1, 2, 3', lat: 5.8990, lng: 116.1150, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Nosoob Jaya / Nosoob Baru', lat: 5.9310, lng: 116.0810, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Kobusak Villa / Kobusak Point', lat: 5.9315, lng: 116.0850, desc: 'Kobusak, Penampang', category: 'housing' },
  { name: 'Taman Putera Jaya Penampang', lat: 5.9180, lng: 116.0920, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Sahabat Penampang', lat: 5.9190, lng: 116.0930, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Dabak / Kampung Dabak', lat: 5.9060, lng: 116.0980, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Mahandoi / Kampung Mahandoi', lat: 5.8890, lng: 116.0890, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Vista Minintod', lat: 5.9310, lng: 116.1260, desc: 'Minintod, Penampang', category: 'housing' },
  { name: 'Kampung Terawi / Terawi Penampang', lat: 5.8920, lng: 116.0850, desc: 'Terawi, Penampang', category: 'housing' },
  { name: 'Kampung Koidupan / Kampung Babah', lat: 5.9020, lng: 116.0910, desc: 'Penampang', category: 'housing' },
  { name: 'Taman Bundusan / Bundusan Villa', lat: 5.9460, lng: 116.1070, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Formosa Bundusan', lat: 5.9470, lng: 116.1020, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Permai Bundusan', lat: 5.9490, lng: 116.1090, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Landmark Bundusan', lat: 5.9440, lng: 116.1090, desc: 'Bundusan, Penampang', category: 'housing' },
  { name: 'Taman Khidmat Bukit Padang', lat: 5.9580, lng: 116.1050, desc: 'Bukit Padang, Luyang', category: 'housing' },
  { name: 'Taman Kepayan Ridge / Jalan 3D', lat: 5.9412, lng: 116.0715, desc: 'Kepayan Ridge, KK', category: 'housing' },
  { name: 'Austral Park Kepayan', lat: 5.9380, lng: 116.0720, desc: 'Kepayan / KK', category: 'housing' },
  { name: 'Taman Sri Kepayan / Kepayan Point', lat: 5.9350, lng: 116.0690, desc: 'Kepayan', category: 'housing' },
  { name: 'Taman Ganang / Ganang Villa', lat: 5.9290, lng: 116.0680, desc: 'Kepayan / Penampang', category: 'housing' },
  { name: 'Taman Ridgeview Kepayan', lat: 5.9430, lng: 116.0740, desc: 'Kepayan, KK', category: 'housing' },
  { name: 'Taman Tanjung Aru / Rumah Pangsa', lat: 5.9520, lng: 116.0540, desc: 'Tanjung Aru', category: 'housing' },
  { name: 'Taman Likas Jaya / Likas Bay', lat: 5.9910, lng: 116.1020, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Antarabangsa Likas', lat: 5.9880, lng: 116.1080, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Seri Likas', lat: 5.9890, lng: 116.1050, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Kingfisher Likas / Sulaman', lat: 6.0150, lng: 116.1260, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Pasir Putih Likas', lat: 5.9850, lng: 116.1090, desc: 'Likas, KK', category: 'housing' },
  { name: 'Taman Nountun Inanam', lat: 5.9890, lng: 116.1280, desc: 'Inanam, KK', category: 'housing' },
  { name: 'Taman Impian Inanam / Inanam Villa', lat: 5.9930, lng: 116.1360, desc: 'Inanam, KK', category: 'housing' },
  { name: 'Taman Kionsom Inanam', lat: 5.9870, lng: 116.1480, desc: 'Kionsom, Inanam', category: 'housing' },
  { name: 'Taman Nelly Kolombong', lat: 5.9620, lng: 116.1100, desc: 'Kolombong, KK', category: 'housing' },
  { name: 'Taman Kolombong / Taman Bunga Raja', lat: 5.9790, lng: 116.1180, desc: 'Kolombong, KK', category: 'housing' },
  { name: 'Taman Khidmat Kolombong', lat: 5.9610, lng: 116.1090, desc: 'Kolombong / Luyang', category: 'housing' },
  { name: 'Bandar Sierra Menggatal / Telipok', lat: 6.0620, lng: 116.1680, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Indah Permai (IP Menggatal)', lat: 6.0490, lng: 116.1450, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Bukit Sepangar', lat: 6.0520, lng: 116.1380, desc: 'Sepanggar, KK', category: 'housing' },
  { name: 'Taman Kuala Menggatal', lat: 6.0240, lng: 116.1490, desc: 'Menggatal, KK', category: 'housing' },
  { name: 'Taman Putera Jaya Telipok', lat: 6.0810, lng: 116.1850, desc: 'Telipok, Menggatal', category: 'housing' },
  { name: 'Taman Cantek Lido', lat: 5.9440, lng: 116.0790, desc: 'Lido / Luyang', category: 'housing' },
  { name: 'Taman Foh Sang / Golden City', lat: 5.9540, lng: 116.0890, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Bornion / Taman Hilltop', lat: 5.9510, lng: 116.0930, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Friendly / Taman Foo Loong', lat: 5.9590, lng: 116.0920, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Luyang Phase 1-8', lat: 5.9530, lng: 116.0870, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Dixon Luyang', lat: 5.9460, lng: 116.0910, desc: 'Luyang, KK', category: 'housing' },
  { name: 'Taman Bersatu Putatan', lat: 5.8910, lng: 116.0580, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Pasir Putih Putatan', lat: 5.8880, lng: 116.0490, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Sri Keramat Putatan', lat: 5.8960, lng: 116.0530, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Jumbo Petagas', lat: 5.9080, lng: 116.0560, desc: 'Petagas, Putatan', category: 'housing' },
  { name: 'Bukit Vor Villa Putatan', lat: 5.8810, lng: 116.0480, desc: 'Putatan', category: 'housing' },
  { name: 'Taman Rose Kinarut', lat: 5.8190, lng: 116.0390, desc: 'Kinarut, Papar', category: 'housing' },
  { name: 'Taman Sungai Wang Kinarut', lat: 5.8230, lng: 116.0420, desc: 'Kinarut, Papar', category: 'housing' },

  // ==========================================
  // 4. HOTELS & RESORTS
  // ==========================================
  { name: 'Le Meridien Kota Kinabalu', lat: 5.9785, lng: 116.0710, desc: 'Jalan Tun Fuad Stephens, KK City', category: 'hotel' },
  { name: 'Hilton Kota Kinabalu', lat: 5.9750, lng: 116.0760, desc: 'Jalan Asia City, KK City', category: 'hotel' },
  { name: 'Hyatt Regency Kinabalu', lat: 5.9860, lng: 116.0765, desc: 'Jalan Datuk Salleh Sulong, KK City', category: 'hotel' },
  { name: 'Hyatt Centric Kota Kinabalu', lat: 5.9880, lng: 116.0780, desc: 'Jalan Haji Saman, KK City', category: 'hotel' },
  { name: 'Kota Kinabalu Marriott Hotel', lat: 5.9740, lng: 116.0680, desc: 'Jalan Tun Fuad Stephens, KK Waterfront', category: 'hotel' },
  { name: 'Promenade Hotel Kota Kinabalu', lat: 5.9745, lng: 116.0700, desc: 'Api-Api Centre, KK City', category: 'hotel' },
  { name: 'The Magellan Sutera Resort', lat: 5.9650, lng: 116.0580, desc: 'Sutera Harbour, KK', category: 'hotel' },
  { name: 'The Pacific Sutera Hotel', lat: 5.9620, lng: 116.0590, desc: 'Sutera Harbour, KK', category: 'hotel' },
  { name: 'Shangri-La Tanjung Aru Resort', lat: 5.9560, lng: 116.0460, desc: 'Tanjung Aru, KK', category: 'hotel' },
  { name: 'Horizon Hotel Kota Kinabalu', lat: 5.9830, lng: 116.0770, desc: 'Jalan Pantai, KK City', category: 'hotel' },
  { name: 'Grandis Hotels and Resorts', lat: 5.9870, lng: 116.0775, desc: 'Suria Sabah Shopping Mall, KK', category: 'hotel' },
  { name: 'Ming Garden Hotel & Residences', lat: 5.9690, lng: 116.0680, desc: 'Lorong Ming Garden, KK', category: 'hotel' },
  { name: 'The Palace Hotel Kota Kinabalu', lat: 5.9760, lng: 116.0820, desc: 'Bukit Tangki, Karamunsing, KK', category: 'hotel' },
  { name: 'Avangio Hotel Kota Kinabalu', lat: 5.9680, lng: 116.1090, desc: 'Metro Town, Kolombong', category: 'hotel' },
  { name: 'Cititel Express Kota Kinabalu', lat: 5.9765, lng: 116.0755, desc: 'Asia City, KK', category: 'hotel' },
  { name: 'The Klagan Hotel', lat: 5.9780, lng: 116.0730, desc: 'Warisan Square, KK', category: 'hotel' },
  { name: 'The Klagan Regency Hotel', lat: 6.0370, lng: 116.1290, desc: '1Borneo Hypermall, Jalan Sulaman', category: 'hotel' },
  { name: 'Gaya Centre Hotel', lat: 5.9865, lng: 116.0785, desc: 'Jalan Tun Fuad Stephens, KK', category: 'hotel' },
  { name: 'Dreamtel Kota Kinabalu', lat: 5.9820, lng: 116.0790, desc: 'Jalan Padang, KK City', category: 'hotel' },
  { name: 'Pan Borneo Hotel Kota Kinabalu', lat: 5.8910, lng: 116.0510, desc: 'Putatan, Penampang / KK', category: 'hotel' },
  { name: 'Langkah Syabas Beach Resort', lat: 5.8150, lng: 116.0280, desc: 'Kampung Kinarut Laut, Papar', category: 'hotel' },
  { name: 'Celyn Hotel City Mall', lat: 5.9635, lng: 116.1015, desc: 'City Mall, Jalan Lintas', category: 'hotel' },
  { name: 'ibis Styles Kota Kinabalu Inanam', lat: 5.9890, lng: 116.1260, desc: 'Jalan Taipan, Inanam', category: 'hotel' },

  // ==========================================
  // 5. COMMUNITY POIS, HOSPITALS, CHURCHES & MOSQUES
  // ==========================================
  { name: 'Walai Good Shepherd, Likas', lat: 5.9865, lng: 116.1030, desc: 'Batu 3.5, Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'Good Shepherd Services Sabah', lat: 5.9865, lng: 116.1030, desc: 'Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'St. Simon Catholic Church, Likas', lat: 5.9860, lng: 116.1035, desc: 'Jalan Tuaran, Likas', category: 'landmark' },
  { name: 'St. Michael Catholic Church Penampang', lat: 5.9100, lng: 116.1070, desc: 'Donggongon, Penampang', category: 'landmark' },
  { name: 'Holy Nativity Church Terawi', lat: 5.8920, lng: 116.0850, desc: 'Terawi, Penampang', category: 'landmark' },
  { name: 'Sacred Heart Cathedral Kota Kinabalu', lat: 5.9680, lng: 116.0780, desc: 'Karamunsing, KK', category: 'landmark' },
  { name: 'Hospital Wanita dan Kanak-Kanak Likas (HWKKS)', lat: 6.0150, lng: 116.1260, desc: 'Kingfisher, Likas', category: 'landmark' },
  { name: 'Hospital Queen Elizabeth (QEH 1)', lat: 5.9540, lng: 116.0710, desc: 'Jalan Penampang, Kepayan', category: 'landmark' },
  { name: 'Hospital Queen Elizabeth II (QEH 2 Damai)', lat: 5.9680, lng: 116.0920, desc: 'Damai, Luyang, KK', category: 'landmark' },
  { name: 'KPJ Sabah Specialist Hospital', lat: 5.9660, lng: 116.0910, desc: 'Damai, Luyang, KK', category: 'landmark' },
  { name: 'Gleneagles Hospital Kota Kinabalu', lat: 5.9690, lng: 116.0640, desc: 'Riverson, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Penampang', lat: 5.9110, lng: 116.1040, desc: 'Donggongon, Penampang', category: 'landmark' },
  { name: 'Klinik Kesihatan Luyang', lat: 5.9560, lng: 116.0870, desc: 'Luyang, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Menggatal', lat: 6.0210, lng: 116.1540, desc: 'Menggatal, KK', category: 'landmark' },
  { name: 'Klinik Kesihatan Putatan', lat: 5.8900, lng: 116.0500, desc: 'Putatan', category: 'landmark' },
  { name: 'Kompleks Sukan Likas (Stadium Likas)', lat: 5.9820, lng: 116.0960, desc: 'Likas, KK', category: 'landmark' },
  { name: 'Masjid Bandaraya Kota Kinabalu (Masjid Terapung)', lat: 5.9960, lng: 116.0850, desc: 'Teluk Likas, KK', category: 'landmark' },
  { name: 'Masjid Negeri Sabah', lat: 5.9610, lng: 116.0730, desc: 'Sembulan, KK', category: 'landmark' },
  { name: 'Menara Tun Mustapha (Yayasan Sabah)', lat: 6.0160, lng: 116.1110, desc: 'Teluk Likas, KK', category: 'landmark' },
  { name: 'Pusat Konvensyen Antarabangsa Sabah (SICC)', lat: 5.9920, lng: 116.0880, desc: 'Tanjung Lipat, Likas', category: 'landmark' },
  { name: 'Universiti Malaysia Sabah (UMS)', lat: 6.0350, lng: 116.1200, desc: 'Teluk Likas / Sulaman', category: 'landmark' },
  { name: 'Politeknik Kota Kinabalu (PKK)', lat: 6.0680, lng: 116.1450, desc: 'Sepanggar, KK', category: 'landmark' },
  { name: 'IPK Sabah (Ibu Pejabat Polis Kontinjen)', lat: 5.9410, lng: 116.0650, desc: 'Kepayan, KK', category: 'landmark' },
  { name: 'KKIA Terminal 1 (Lapangan Terbang KK)', lat: 5.9370, lng: 116.0510, desc: 'Kepayan / Tanjung Aru', category: 'landmark' },
  { name: 'Jesselton Point Ferry Terminal', lat: 5.9910, lng: 116.0790, desc: 'Jesselton, KK', category: 'landmark' },
  { name: 'Pasar Kraftangan / Pasar Filipina', lat: 5.9810, lng: 116.0720, desc: 'KK Waterfront', category: 'landmark' },
];

// Distance Calculation (Haversine formula in meters)
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearest landmark within proximity threshold (default 120m)
export function findNearestSabahLandmark(lat: number, lng: number, maxMeters = 120): { landmark: SabahLocationItem; distanceMeters: number } | null {
  let closest: SabahLocationItem | null = null;
  let minDistance = Infinity;

  for (const item of LOCAL_SABAH_LANDMARKS) {
    const dist = getDistanceMeters(lat, lng, item.lat, item.lng);
    if (dist <= maxMeters && dist < minDistance) {
      minDistance = dist;
      closest = item;
    }
  }

  return closest ? { landmark: closest, distanceMeters: Math.round(minDistance) } : null;
}

// Clean house/unit number prefix
export function extractHouseNumberPrefix(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|sd|lorong|jalan)\s*[a-z0-9\-\/]+|[0-9]+[a-z]?)(?:,\s*(?:lorong|jalan|blok|tingkat)\s*[a-z0-9]+)?/i);
  return match ? match[0].trim().replace(/,+$/, '') : '';
}

export function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/^(?:(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|sd|lorong|jalan)\s*[a-z0-9\-\/]+|[0-9]+[a-z]?)(?:,\s*(?:lorong|jalan|blok|tingkat)\s*[a-z0-9]+)?/i, '')
    .replace(/(?:lot|no\.?|house|rumah|unit|tingkat|blok|block|pintu|apt|apartment|hotel|residence|condo|condominium|taman|jalan|lorong)\s*[a-z0-9\-\/]+/gi, '')
    .replace(/[,\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchSabahLocations(rawQuery: string) {
  const housePrefix = extractHouseNumberPrefix(rawQuery);
  const cleanQ = sanitizeSearchQuery(rawQuery).toLowerCase();
  const rawQ = rawQuery.toLowerCase().trim();
  const tokens = (cleanQ || rawQ).split(' ').filter(t => t.length >= 2);

  return LOCAL_SABAH_LANDMARKS.map(item => {
    const itemName = item.name.toLowerCase();
    const itemDesc = item.desc.toLowerCase();
    const fullText = `${itemName} ${itemDesc} ${item.category}`;

    let score = 0;
    if (itemName.includes(cleanQ) || itemDesc.includes(cleanQ)) {
      score += 100;
    }

    tokens.forEach(tok => {
      if (itemName.includes(tok)) score += 30;
      if (itemDesc.includes(tok)) score += 15;
      if (fullText.includes(tok)) score += 5;
    });

    return { item, score };
  })
  .filter(res => res.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 8)
  .map(res => {
    const matched = res.item;
    const finalDisplay = housePrefix 
      ? `${housePrefix}, ${matched.name}, ${matched.desc}, Sabah`
      : `${matched.name}, ${matched.desc}, Sabah`;

    return {
      displayName: finalDisplay,
      mainText: housePrefix ? `${housePrefix}, ${matched.name}` : matched.name,
      secondaryText: `${matched.desc}, Sabah`,
      lat: matched.lat,
      lng: matched.lng
    };
  });
}

// Smart Sabah Reverse Geocoding with POI & Proximity Landmarking
export async function reverseGeocodeSabahCoordinates(lat: number, lng: number): Promise<string> {
  // 1. Check local high-precision landmark database within 120m
  const nearest = findNearestSabahLandmark(lat, lng, 120);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&countrycodes=my&addressdetails=1&namedetails=1&extratags=1`
    );
    const data = await res.json();
    
    if (data && data.address) {
      const addr = data.address;
      const namedetails = data.namedetails || {};
      const extratags = data.extratags || {};
      
      const poiName = 
        namedetails.name || 
        data.name || 
        extratags.brand || 
        addr.amenity || 
        addr.shop || 
        addr.commercial || 
        addr.retail || 
        addr.building || 
        '';

      const houseNo = addr.house_number || addr.housenumber || addr.unit || '';
      const road = addr.road || addr.street || addr.residential || addr.highway || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || '';
      const city = addr.city || addr.town || 'Penampang';
      const state = addr.state || 'Sabah';
      const postcode = addr.postcode || '89500';

      // If we found a curated high-confidence local landmark within proximity (e.g. Padimas Point)
      // prioritize the Landmark cleanly without confusing cross-street mixups
      if (nearest && nearest.distanceMeters <= 120) {
        const prefix = houseNo ? `Unit/Lot ${houseNo}, ` : '';
        return `${prefix}${nearest.landmark.name}, ${nearest.landmark.desc}, Sabah`;
      }

      const parts = [
        poiName ? poiName : '',
        houseNo ? `No. ${houseNo}` : '',
        road,
        suburb,
        city,
        postcode,
        state
      ].filter(Boolean);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    if (nearest) {
      return `${nearest.landmark.name}, ${nearest.landmark.desc}, Sabah`;
    }

    if (data && data.display_name) {
      return data.display_name;
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    if (nearest) {
      return `${nearest.landmark.name}, ${nearest.landmark.desc}, Sabah`;
    }
  }

  return `Lokasi (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

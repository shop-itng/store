export interface AreaLocation {
  state: string;
  city: string;
  area: string;
}

export interface StateData {
  state: string;
  zone: string;
  cities: {
    city: string;
    areas: string[];
  }[];
}

export const NIGERIAN_STATES: StateData[] = [
  // --- SOUTH WEST ---
  {
    state: 'Lagos',
    zone: 'South West',
    cities: [
      {
        city: 'Lagos Mainland',
        areas: ['Yaba', 'Akoka', 'Sabo', 'Surulere', 'Ebute Metta', 'Jibowu', 'Bariga', 'Fadeyi', 'Gbagada', 'Anthony Village', 'Maryland'],
      },
      {
        city: 'Ikeja & Environs',
        areas: ['Allen Avenue', 'Opebi', 'Computer Village', 'GRA Ikeja', 'Ogba', 'Agidingbi', 'Alausa', 'Ojodu Berger'],
      },
      {
        city: 'Lagos Island',
        areas: ['Marina', 'Victoria Island (VI)', 'Ikoyi', 'Obalende', 'Onikan', 'Lekki Phase 1', 'Banana Island'],
      },
      {
        city: 'Lekki & Ajah',
        areas: ['Ikate', 'Jakande', 'Chevron', 'VGC', 'Ajah', 'Sangotedo', 'Awoyaya', 'Bogije', 'Epe'],
      },
      {
        city: 'Ikorodu',
        areas: ['Ikorodu Town', 'Agric', 'Benson', 'Ogolonto', 'Laspotech / Ikorodu', 'Igbogbo'],
      },
      {
        city: 'Festac & Ojo',
        areas: ['Festac Town', 'Mile 2', 'Alaba', 'LASU / Ojo', 'Okokomaiko', 'Satellite Town'],
      },
    ],
  },
  {
    state: 'Ogun',
    zone: 'South West',
    cities: [
      {
        city: 'Abeokuta',
        areas: ['Ibara', 'Kuto', 'Pansheke', 'Camp (FUNAAB)', 'Asero', 'Oke-Mosan', 'Adigbe'],
      },
      {
        city: 'Ota',
        areas: ['Covenant / Hebron Area', 'Sango Ota', 'Bells Area', 'Toll Gate', 'Itele'],
      },
      {
        city: 'Sagamu & Remo',
        areas: ['GRA Sagamu', 'Sabo Sagamu', 'Remo High', 'Isale Oko'],
      },
      {
        city: 'Ijebu Ode',
        areas: ['Ijebu Ode Town', 'Molipa', 'TASUED / Ijagun', 'Igbeba'],
      },
    ],
  },
  {
    state: 'Oyo',
    zone: 'South West',
    cities: [
      {
        city: 'Ibadan',
        areas: ['Bodija', 'UI / Agbowo', 'Samonda', 'Dugbe', 'Ring Road', 'Mokola', 'Jericho', 'Eleyele', 'Iwo Road', 'Akobo', 'Oluyole'],
      },
      {
        city: 'Ogbomoso',
        areas: ['Under G (LAUTECH)', 'Caretaker', 'Takie', 'Stadium Area', 'Adenike'],
      },
      {
        city: 'Oyo Town',
        areas: ['Ajayi Crowther Area', 'Owode', 'Akunlemu', 'Isale Oyo'],
      },
    ],
  },
  {
    state: 'Osun',
    zone: 'South West',
    cities: [
      {
        city: 'Osogbo',
        areas: ['Alekuwodo', 'Ogo-Oluwa', 'Oke-Fia', 'Station Road', 'UNIOSUN Area'],
      },
      {
        city: 'Ile-Ife',
        areas: ['OAU Campus Gate', 'Mayfair', 'Asherifa', 'Lagere', 'Ede Road'],
      },
      {
        city: 'Ede',
        areas: ['Federal Poly Area', 'Adeleke Univ Area', 'Akoda', 'Ede Central'],
      },
    ],
  },
  {
    state: 'Ondo',
    zone: 'South West',
    cities: [
      {
        city: 'Akure',
        areas: ['FUTA North Gate', 'FUTA South Gate', 'Alagbaka GRA', 'Ijapo Estate', 'Oba Adesida Road', 'Oja Oba'],
      },
      {
        city: 'Ondo Town',
        areas: ['UNIMED Area', 'Yaba Ondo', 'Bagbe', 'Ondo Central'],
      },
    ],
  },
  {
    state: 'Ekiti',
    zone: 'South West',
    cities: [
      {
        city: 'Ado-Ekiti',
        areas: ['EKSU Campus Gate', 'Fajuyi Park', 'GRA Ado', 'Basiri', 'Ajilosun', 'Similoluwa'],
      },
      {
        city: 'Ikere-Ekiti',
        areas: ['College of Education Area', 'Ugele', 'Ikere Central'],
      },
      {
        city: 'Oye-Ekiti',
        areas: ['FUOYE Campus Area', 'Oye Central', 'Ilumoba'],
      },
    ],
  },

  // --- FEDERAL CAPITAL TERRITORY (FCT) ---
  {
    state: 'Abuja (FCT)',
    zone: 'North Central',
    cities: [
      {
        city: 'Abuja Central',
        areas: ['Wuse 2', 'Wuse 1', 'Maitama', 'Garki 1', 'Garki 2', 'Asokoro', 'Utako', 'Jabi', 'Central Business District'],
      },
      {
        city: 'Gwarinpa & Dawaki',
        areas: ['Gwarinpa 1st Ave', 'Gwarinpa 3rd Ave', 'Dawaki', 'Galadimawa', 'Lokogoma', 'Kado'],
      },
      {
        city: 'Kubwa & Dutse',
        areas: ['Kubwa Phase 4', 'Kubwa Federal Housing', 'Dutse Alhaji', 'Bwari / Veritas Univ', 'Ushafa'],
      },
      {
        city: 'Lugbe & Airport Road',
        areas: ['Lugbe Federal Housing', 'Pyakasa', 'TradeMore Estate', 'Airport Road Hub'],
      },
    ],
  },

  // --- NORTH CENTRAL ---
  {
    state: 'Kwara',
    zone: 'North Central',
    cities: [
      {
        city: 'Ilorin',
        areas: ['Tanke (Unilorin)', 'Fate Road', 'GRA Ilorin', 'Tipper Garage', 'Post Office', 'Gaa Akanbi', 'Taiwo Road'],
      },
      {
        city: 'Offa & Malete',
        areas: ['KWASU / Malete Area', 'Offa Poly Area', 'Olofa Way'],
      },
    ],
  },
  {
    state: 'Kogi',
    zone: 'North Central',
    cities: [
      {
        city: 'Lokoja',
        areas: ['Federal Poly Area', 'GRA Lokoja', 'Ganaja Village', 'Kogi State Univ / Anyigba', 'Paparanda'],
      },
    ],
  },
  {
    state: 'Benue',
    zone: 'North Central',
    cities: [
      {
        city: 'Makurdi',
        areas: ['BSU Campus Area', 'High Level', 'Wurukum', 'North Bank', 'Federal Univ of Agriculture'],
      },
    ],
  },
  {
    state: 'Nasarawa',
    zone: 'North Central',
    cities: [
      {
        city: 'Lafia & Keffi',
        areas: ['Keffi (NSUK Area)', 'Lafia GRA', 'Federal Poly Nasarawa', 'Keffi Central'],
      },
    ],
  },
  {
    state: 'Niger',
    zone: 'North Central',
    cities: [
      {
        city: 'Minna & Suleja',
        areas: ['FUT Minna (Gidan Kwano)', 'FUT Minna (Bosso)', 'Tunga', 'Suleja Main Market', 'GRA Minna'],
      },
    ],
  },
  {
    state: 'Plateau',
    zone: 'North Central',
    cities: [
      {
        city: 'Jos',
        areas: ['Unijos (Naraguta)', 'Unijos (Bauchi Road)', 'Rayfield', 'Terminus', 'Bukuru', 'Tudun Wada'],
      },
    ],
  },

  // --- SOUTH SOUTH ---
  {
    state: 'Rivers',
    zone: 'South South',
    cities: [
      {
        city: 'Port Harcourt',
        areas: ['GRA Phase 2', 'D/Line', 'Peter Odili Road', 'Choba (Uniport)', 'Rumuokoro', 'Woji', 'Old GRA', 'Trans-Amadi', 'Ada George'],
      },
    ],
  },
  {
    state: 'Edo',
    zone: 'South South',
    cities: [
      {
        city: 'Benin City',
        areas: ['Ugbowo (Uniben)', 'GRA Benin', 'Ring Road', 'Airport Road', 'Ekenwan (Uniben Gate)', 'New Benin', 'Ekpoma (AAU)'],
      },
    ],
  },
  {
    state: 'Delta',
    zone: 'South South',
    cities: [
      {
        city: 'Asaba',
        areas: ['Okpanam Road', 'Nnebisi Road', 'Cable Point', 'GRA Asaba', 'Anwai (DELSU)'],
      },
      {
        city: 'Warri & Abraka',
        areas: ['DELSU Abraka', 'Effurun', 'GRA Warri', 'Airport Road Warri', 'Enerhen', 'PTI Area'],
      },
    ],
  },
  {
    state: 'Akwa Ibom',
    zone: 'South South',
    cities: [
      {
        city: 'Uyo',
        areas: ['Uniuyo Town Campus', 'Uniuyo Permanent Site', 'Ewet Housing Estate', 'Ikot Ekpene Road', 'Oron Road', 'Shelter Afrique'],
      },
    ],
  },
  {
    state: 'Cross River',
    zone: 'South South',
    cities: [
      {
        city: 'Calabar',
        areas: ['Unical Campus Area', 'Marian Road', 'State Housing', 'Murtala Mohammed Way', 'Goldie Street'],
      },
    ],
  },
  {
    state: 'Bayelsa',
    zone: 'South South',
    cities: [
      {
        city: 'Yenagoa & Amassoma',
        areas: ['NDU (Amassoma)', 'Kpansia', 'Amarata', 'Swali', 'Oxbow Lake Area'],
      },
    ],
  },

  // --- SOUTH EAST ---
  {
    state: 'Enugu',
    zone: 'South East',
    cities: [
      {
        city: 'Enugu City',
        areas: ['Independence Layout', 'New Haven', 'Ogui Road', 'Trans-Ekulu', 'Abakpa', 'ESUT Area', 'Coal Camp'],
      },
      {
        city: 'Nsukka',
        areas: ['UNN Campus Area', 'Ofulonu', 'Total Roundabout', 'Aku Road', 'University Market'],
      },
    ],
  },
  {
    state: 'Anambra',
    zone: 'South East',
    cities: [
      {
        city: 'Awka',
        areas: ['Aroma Junction', 'Ifite (UNIZIK)', 'Temp Site', 'Club Road', 'Okpuno'],
      },
      {
        city: 'Onitsha',
        areas: ['GRA Onitsha', 'Upper Iweka', 'Main Market Area', '3-3 Area', 'Awka Road'],
      },
      {
        city: 'Nnewi',
        areas: ['Otolo', 'Umudim', 'Nnewi-Ozubulu Road', 'Nkwo Nnewi'],
      },
    ],
  },
  {
    state: 'Imo',
    zone: 'South East',
    cities: [
      {
        city: 'Owerri',
        areas: ['FUTO (Ihiagwa)', 'IMSU Gate Area', 'Aladinma', 'Ikenegbu', 'Tetlow Road', 'World Bank Estate'],
      },
    ],
  },
  {
    state: 'Abia',
    zone: 'South East',
    cities: [
      {
        city: 'Umuahia',
        areas: ['MOUAU / Umudike', 'GRA Umuahia', 'Bank Road', 'Isi Gate'],
      },
      {
        city: 'Aba',
        areas: ['Ariaria Market Area', 'Faulks Road', 'Abayi', 'GRA Aba'],
      },
    ],
  },
  {
    state: 'Ebonyi',
    zone: 'South East',
    cities: [
      {
        city: 'Abakaliki',
        areas: ['EBSU Perm Site', 'Water Works Road', 'Mile 50', 'Ogoja Road', 'Kpirikpiri'],
      },
    ],
  },

  // --- NORTH WEST ---
  {
    state: 'Kano',
    zone: 'North West',
    cities: [
      {
        city: 'Kano City',
        areas: ['BUK Old Site', 'BUK New Site', 'Nassarawa GRA', 'Bompai', 'Sabon Gari', 'Fagge', 'Kano State Poly Area'],
      },
    ],
  },
  {
    state: 'Kaduna',
    zone: 'North West',
    cities: [
      {
        city: 'Kaduna City',
        areas: ['Barnawa', 'Malali', 'Kaduna South', 'GRA Kaduna', 'KASU Area', 'Tudun Wada'],
      },
      {
        city: 'Zaria',
        areas: ['Samaru (ABU)', 'Kongo (ABU)', 'Sabon Gari Zaria', 'PZ Area'],
      },
    ],
  },
  {
    state: 'Katsina',
    zone: 'North West',
    cities: [
      {
        city: 'Katsina City',
        areas: ['UMYU Area', 'Federal Poly Daura Area', 'GRA Katsina', 'Kofar Kaura'],
      },
    ],
  },
  {
    state: 'Sokoto',
    zone: 'North West',
    cities: [
      {
        city: 'Sokoto City',
        areas: ['UDUS (Permanent Site)', 'UDUS (Town Campus)', 'GRA Sokoto', 'Runjin Sambo'],
      },
    ],
  },
  {
    state: 'Kebbi',
    zone: 'North West',
    cities: [
      {
        city: 'Birnin Kebbi',
        areas: ['FUKebbi Area', 'GRA Birnin Kebbi', 'Haliru Abdu Secretariat Area'],
      },
    ],
  },
  {
    state: 'Jigawa',
    zone: 'North West',
    cities: [
      {
        city: 'Dutse',
        areas: ['Federal Univ Dutse (FUD)', 'GRA Dutse', 'Kiyawa Road'],
      },
    ],
  },
  {
    state: 'Zamfara',
    zone: 'North West',
    cities: [
      {
        city: 'Gusau',
        areas: ['Federal Univ Gusau Area', 'GRA Gusau', 'Canteen Area'],
      },
    ],
  },

  // --- NORTH EAST ---
  {
    state: 'Bauchi',
    zone: 'North East',
    cities: [
      {
        city: 'Bauchi City',
        areas: ['ATBU (Yelwa)', 'ATBU (Gubi)', 'Federal Poly Bauchi', 'GRA Bauchi'],
      },
    ],
  },
  {
    state: 'Borno',
    zone: 'North East',
    cities: [
      {
        city: 'Maiduguri',
        areas: ['UNIMAID Campus Area', 'Post Office Area', 'GRA Maiduguri', 'Baga Road'],
      },
    ],
  },
  {
    state: 'Adamawa',
    zone: 'North East',
    cities: [
      {
        city: 'Yola & Mubi',
        areas: ['MAUTECH Area', 'AUN Area', 'Jimeta Main Market', 'Mubi Central'],
      },
    ],
  },
  {
    state: 'Gombe',
    zone: 'North East',
    cities: [
      {
        city: 'Gombe City',
        areas: ['Gombe State Univ Area', 'Federal Univ Kashere', 'GRA Gombe'],
      },
    ],
  },
  {
    state: 'Taraba',
    zone: 'North East',
    cities: [
      {
        city: 'Jalingo',
        areas: ['Taraba State Univ Area', 'Federal Univ Wukari', 'GRA Jalingo'],
      },
    ],
  },
  {
    state: 'Yobe',
    zone: 'North East',
    cities: [
      {
        city: 'Damaturu & Potiskum',
        areas: ['Yobe State Univ Area', 'Federal Poly Damaturu', 'Potiskum Central'],
      },
    ],
  },
];

/**
 * Calculates delivery cost between two locations:
 * - Same area: ₦300 (or free local pickup safe spot)
 * - Same city, different area: ₦800 (local dispatch)
 * - Same state, different city: ₦1,500
 * - Different states: ₦2,500 (interstate)
 */
export function calculateDeliveryFee(
  sellerLoc: { state: string; city: string; area: string },
  buyerLoc?: { state: string; city: string; area: string } | null
): { fee: number; method: string } {
  if (!buyerLoc || !buyerLoc.area) {
    return { fee: 500, method: 'Standard Delivery' };
  }

  if (sellerLoc.state.toLowerCase() === buyerLoc.state.toLowerCase()) {
    if (sellerLoc.city.toLowerCase() === buyerLoc.city.toLowerCase()) {
      if (sellerLoc.area.toLowerCase() === buyerLoc.area.toLowerCase()) {
        return { fee: 300, method: `Same Area (${sellerLoc.area}) safe handoff` };
      }
      return { fee: 800, method: `Within ${sellerLoc.city} dispatch` };
    }
    return { fee: 1500, method: `Intra-${sellerLoc.state} delivery` };
  }

  return { fee: 2500, method: `Interstate (${sellerLoc.state} to ${buyerLoc.state})` };
}

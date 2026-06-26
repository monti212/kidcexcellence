export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface Fee {
  grade: string;
  termly: number;
  annually: number;
}

export interface Provider {
  id: string;
  name: string;
  category: string;
  location: string;
  price: number;
  priceUnit: "monthly" | "per day" | "per hour" | "termly";
  rating: number;
  reviewCount: number;
  verified: boolean;
  bio: string;
  image: string;
  services: string[];
  experience: string;
  availability: string;
  gallery?: string[];
  fees?: Fee[];
  phone: string;
  email: string;
  whatsapp: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
}

export interface Conversation {
  id: string;
  participant: string;
  participantImage: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  messages: Message[];
}

export const CATEGORIES: Category[] = [
  { id: "schools", name: "Schools", icon: "🏫", count: 48 },
  { id: "nurseries", name: "Nurseries", icon: "🌱", count: 63 },
  { id: "nannies", name: "Nannies", icon: "👩‍👧", count: 112 },
  { id: "babysitters", name: "Babysitters", icon: "🍼", count: 87 },
  { id: "pediatric-clinics", name: "Pediatric Clinics", icon: "🏥", count: 24 },
  { id: "tutors", name: "Tutors", icon: "📚", count: 76 },
];

export const PROVIDERS: Provider[] = [
  {
    id: "1",
    name: "Sunshine Early Learning Centre",
    category: "schools",
    location: "Phakalane, Gaborone",
    price: 2800,
    priceUnit: "termly",
    rating: 4.9,
    reviewCount: 42,
    verified: true,
    bio: "Sunshine Early Learning Centre is a premier early childhood development school in Phakalane, Gaborone. We offer a nurturing and stimulating environment for children aged 18 months to 6 years. Our qualified educators use the Cambridge curriculum blended with Setswana cultural values to deliver outstanding early learning experiences.",
    image: "https://picsum.photos/400/300?random=1",
    services: [
      "Baby class (18 months - 2 yrs)",
      "Toddler class (2 - 3 yrs)",
      "Nursery (3 - 4 yrs)",
      "Reception (4 - 5 yrs)",
      "Grade 1 (5 - 6 yrs)",
      "Aftercare",
      "Holiday programs",
    ],
    experience: "Established in 2010, 14 years of operation",
    availability: "Monday to Friday, 7:00 AM - 5:30 PM",
    gallery: [
      "https://picsum.photos/400/300?random=11",
      "https://picsum.photos/400/300?random=12",
      "https://picsum.photos/400/300?random=13",
      "https://picsum.photos/400/300?random=14",
      "https://picsum.photos/400/300?random=15",
      "https://picsum.photos/400/300?random=16",
    ],
    fees: [
      { grade: "Baby Class", termly: 2800, annually: 8400 },
      { grade: "Toddler Class", termly: 3000, annually: 9000 },
      { grade: "Nursery", termly: 3200, annually: 9600 },
      { grade: "Reception", termly: 3400, annually: 10200 },
      { grade: "Grade 1", termly: 3600, annually: 10800 },
    ],
    phone: "+267 71 234 567",
    email: "info@sunshineelc.co.bw",
    whatsapp: "+26771234567",
  },
  {
    id: "2",
    name: "Little Stars Nursery",
    category: "nurseries",
    location: "Gaborone West, Gaborone",
    price: 2200,
    priceUnit: "termly",
    rating: 4.7,
    reviewCount: 28,
    verified: true,
    bio: "Little Stars Nursery provides warm, family-oriented childcare for children from 6 weeks to 4 years. Our small class sizes ensure every child receives individual attention. We emphasize play-based learning, social development, and a healthy daily routine.",
    image: "https://picsum.photos/400/300?random=2",
    services: [
      "Infant care (6 weeks - 18 months)",
      "Toddler program (18 months - 3 yrs)",
      "Pre-school (3 - 4 yrs)",
      "Nutritious meals included",
      "Sleep/rest time",
      "Music & movement",
    ],
    experience: "Established in 2015, 9 years of operation",
    availability: "Monday to Friday, 6:30 AM - 6:00 PM",
    gallery: [
      "https://picsum.photos/400/300?random=21",
      "https://picsum.photos/400/300?random=22",
      "https://picsum.photos/400/300?random=23",
      "https://picsum.photos/400/300?random=24",
    ],
    fees: [
      { grade: "Infant Care", termly: 2200, annually: 6600 },
      { grade: "Toddler Program", termly: 2400, annually: 7200 },
      { grade: "Pre-school", termly: 2600, annually: 7800 },
    ],
    phone: "+267 72 345 678",
    email: "hello@littlestarsnursery.co.bw",
    whatsapp: "+26772345678",
  },
  {
    id: "3",
    name: "Kefilwe Modise",
    category: "nannies",
    location: "Tlokweng, Gaborone",
    price: 3500,
    priceUnit: "monthly",
    rating: 4.8,
    reviewCount: 19,
    verified: true,
    bio: "I am a warm and dedicated professional nanny with 8 years of experience caring for young children. I am trained in early childhood development and first aid. I speak both Setswana and English fluently. I create engaging educational activities and provide nutritious meals. I am available for live-in or live-out arrangements.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Kefilwe",
    services: [
      "Full-time childcare",
      "Meal preparation",
      "Educational activities",
      "Light housekeeping",
      "School pickup/dropoff",
      "Bedtime routines",
    ],
    experience: "8 years professional nanny experience",
    availability: "Monday to Saturday, flexible hours",
    phone: "+267 73 456 789",
    email: "kefilwe.modise@gmail.com",
    whatsapp: "+26773456789",
  },
  {
    id: "4",
    name: "Thabo Sithole",
    category: "babysitters",
    location: "Block 9, Gaborone",
    price: 80,
    priceUnit: "per day",
    rating: 4.6,
    reviewCount: 14,
    verified: true,
    bio: "Reliable, fun, and caring babysitter available for evenings, weekends, and school holidays. I am a college student studying education, passionate about child development. I have completed a Child Safety and First Aid course and have experience with children aged 0-4 years.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Thabo",
    services: [
      "Evening babysitting",
      "Weekend care",
      "School holiday cover",
      "Play activities",
      "Bedtime routines",
      "Homework help (older kids)",
    ],
    experience: "3 years babysitting experience, First Aid certified",
    availability: "Weekends and school holidays, available evenings after 5 PM",
    phone: "+267 74 567 890",
    email: "thabo.sithole@gmail.com",
    whatsapp: "+26774567890",
  },
  {
    id: "5",
    name: "Dr. Mpho Ramodupi",
    category: "pediatric-clinics",
    location: "Broadhurst, Gaborone",
    price: 350,
    priceUnit: "per day",
    rating: 4.9,
    reviewCount: 67,
    verified: true,
    bio: "Dr. Ramodupi is a board-certified pediatrician with over 15 years of experience at Princess Marina Hospital and private practice. The clinic specializes in newborn care, well-baby visits, vaccinations, developmental assessments, and acute illness management. Home visits available on request.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Mpho",
    services: [
      "Well-baby check-ups",
      "Vaccinations",
      "Developmental assessments",
      "Newborn care",
      "Acute illness management",
      "Allergy testing",
      "Nutritional counselling",
    ],
    experience: "15+ years pediatric medicine",
    availability: "Monday to Friday 8AM-5PM, Saturday 9AM-1PM",
    phone: "+267 75 678 901",
    email: "drramodupi@kidshealth.co.bw",
    whatsapp: "+26775678901",
  },
  {
    id: "6",
    name: "Naledi Kgomotso",
    category: "tutors",
    location: "Phakalane, Gaborone",
    price: 120,
    priceUnit: "per hour",
    rating: 4.7,
    reviewCount: 31,
    verified: true,
    bio: "Qualified early childhood educator and tutor with a degree in Education from the University of Botswana. I specialise in reading readiness, numeracy foundations, and Setswana language support for children aged 3-7. Sessions are fun, interactive, and tailored to each child's learning style.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Naledi",
    services: [
      "Reading readiness",
      "Numeracy foundations",
      "Setswana language",
      "School readiness",
      "Phonics",
      "Arts and crafts integration",
    ],
    experience: "6 years tutoring and teaching",
    availability: "Monday to Saturday, 2 PM - 7 PM",
    phone: "+267 76 789 012",
    email: "naledi.tutor@gmail.com",
    whatsapp: "+26776789012",
  },
  {
    id: "7",
    name: "Rainbows & Smiles Day Care",
    category: "nurseries",
    location: "Mogoditshane, Gaborone",
    price: 1800,
    priceUnit: "termly",
    rating: 4.5,
    reviewCount: 22,
    verified: true,
    bio: "A cozy and welcoming day care centre in Mogoditshane, serving families in the greater Gaborone area. We offer structured daily programs with lots of outdoor play, creative arts, and early literacy activities. Our staff are all first-aid trained and CRB checked.",
    image: "https://picsum.photos/400/300?random=3",
    services: [
      "Full-day care",
      "Half-day care",
      "Outdoor play area",
      "Creative arts",
      "Storytime",
      "Hot meals",
    ],
    experience: "Established 2018",
    availability: "Monday to Friday 7AM - 5PM",
    gallery: [
      "https://picsum.photos/400/300?random=31",
      "https://picsum.photos/400/300?random=32",
      "https://picsum.photos/400/300?random=33",
    ],
    fees: [
      { grade: "Full-day (under 2)", termly: 1800, annually: 5400 },
      { grade: "Full-day (2-3 yrs)", termly: 2000, annually: 6000 },
      { grade: "Half-day", termly: 1200, annually: 3600 },
    ],
    phone: "+267 77 890 123",
    email: "rainbows@daycare.co.bw",
    whatsapp: "+26777890123",
  },
  {
    id: "8",
    name: "Boitumelo Tau",
    category: "nannies",
    location: "Gabane, Gaborone",
    price: 3000,
    priceUnit: "monthly",
    rating: 4.6,
    reviewCount: 11,
    verified: false,
    bio: "Loving and dependable nanny with 5 years of experience. I specialise in infant care and have completed courses in baby massage, sleep training, and infant nutrition. I am available for live-in arrangements and am comfortable travelling with families.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Boitumelo",
    services: [
      "Infant specialist",
      "Sleep training support",
      "Baby massage",
      "Meal preparation",
      "Live-in available",
      "Travel nanny",
    ],
    experience: "5 years with infants and toddlers",
    availability: "Monday to Sunday, live-in or live-out",
    phone: "+267 78 901 234",
    email: "boitumelo.tau@gmail.com",
    whatsapp: "+26778901234",
  },
  {
    id: "9",
    name: "Gaborone International Pre-School",
    category: "schools",
    location: "Gaborone North, Gaborone",
    price: 4500,
    priceUnit: "termly",
    rating: 4.8,
    reviewCount: 55,
    verified: true,
    bio: "Gaborone International Pre-School offers a world-class early years education following the Early Years Foundation Stage (EYFS) framework. We welcome children from diverse backgrounds and offer an inclusive, multilingual environment. Our state-of-the-art facilities include a swimming pool, outdoor adventure playground, and dedicated arts studio.",
    image: "https://picsum.photos/400/300?random=4",
    services: [
      "Nursery (age 2-3)",
      "Pre-KG (age 3-4)",
      "Kindergarten (age 4-5)",
      "Swimming lessons",
      "Music & drama",
      "French language",
      "Extended care",
    ],
    experience: "Established 2008, 16 years",
    availability: "Monday to Friday 7:30 AM - 5:30 PM",
    gallery: [
      "https://picsum.photos/400/300?random=41",
      "https://picsum.photos/400/300?random=42",
      "https://picsum.photos/400/300?random=43",
      "https://picsum.photos/400/300?random=44",
      "https://picsum.photos/400/300?random=45",
    ],
    fees: [
      { grade: "Nursery", termly: 4500, annually: 13500 },
      { grade: "Pre-KG", termly: 5000, annually: 15000 },
      { grade: "Kindergarten", termly: 5500, annually: 16500 },
    ],
    phone: "+267 79 012 345",
    email: "admissions@gips.co.bw",
    whatsapp: "+26779012345",
  },
  {
    id: "10",
    name: "Letsatsi Sithole",
    category: "babysitters",
    location: "Francistown",
    price: 70,
    priceUnit: "per day",
    rating: 4.4,
    reviewCount: 8,
    verified: false,
    bio: "Friendly and responsible babysitter based in Francistown. I have experience with children aged 0-5 and enjoy creating fun activities. I am a trained Early Childhood Development assistant and hold a current First Aid certificate.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Letsatsi",
    services: [
      "Daytime babysitting",
      "Evening care",
      "Weekend care",
      "Play activities",
      "Storytime",
    ],
    experience: "4 years, ECD assistant trained",
    availability: "Flexible, 7 days a week",
    phone: "+267 71 123 456",
    email: "letsatsi.sithole@gmail.com",
    whatsapp: "+26771123456",
  },
  {
    id: "11",
    name: "Dr. Nneka Osei-Bonsu",
    category: "pediatric-clinics",
    location: "Francistown",
    price: 300,
    priceUnit: "per day",
    rating: 4.7,
    reviewCount: 39,
    verified: true,
    bio: "Experienced pediatric doctor offering comprehensive child healthcare services in Francistown. Specialising in neonatal care, chronic conditions management, and developmental paediatrics. Telehealth consultations available for parents outside Francistown.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Nneka",
    services: [
      "Neonatal care",
      "Well-child visits",
      "Vaccination schedule",
      "Chronic conditions",
      "Telehealth",
      "Developmental screening",
    ],
    experience: "12 years paediatric medicine",
    availability: "Monday to Friday 8AM-4PM",
    phone: "+267 72 234 567",
    email: "drnneka@childhealth.co.bw",
    whatsapp: "+26772234567",
  },
  {
    id: "12",
    name: "Dineo Kgosi",
    category: "tutors",
    location: "Tlokweng, Gaborone",
    price: 100,
    priceUnit: "per hour",
    rating: 4.5,
    reviewCount: 17,
    verified: true,
    bio: "Patient and creative tutor helping young children build strong educational foundations. I specialise in supporting children with learning differences and use multi-sensory teaching methods. I hold a PGCE from Botswana University of Science and Technology.",
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Dineo",
    services: [
      "Learning support",
      "Reading & phonics",
      "Math foundations",
      "Sensory learning",
      "Creative writing",
      "School homework help",
    ],
    experience: "7 years, PGCE qualified",
    availability: "Weekday afternoons and weekends",
    phone: "+267 73 345 678",
    email: "dineo.tutor@gmail.com",
    whatsapp: "+26773345678",
  },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "conv1",
    participant: "Sunshine Early Learning Centre",
    participantImage: "https://picsum.photos/400/300?random=1",
    lastMessage: "Thank you for your inquiry. We'd love to schedule a tour!",
    timestamp: "2m ago",
    unread: 2,
    messages: [
      {
        id: "m1",
        senderId: "parent",
        text: "Hello, I am interested in enrolling my daughter. She turns 3 in February. Do you have spaces available?",
        timestamp: "10:23 AM",
        isOwn: true,
      },
      {
        id: "m2",
        senderId: "provider",
        text: "Good morning! Thank you for reaching out to Sunshine Early Learning Centre. Yes, we do have limited spaces available for our nursery class starting January. We'd love to have your daughter join us!",
        timestamp: "10:35 AM",
        isOwn: false,
      },
      {
        id: "m3",
        senderId: "parent",
        text: "That's wonderful! What are the next steps for enrollment?",
        timestamp: "10:38 AM",
        isOwn: true,
      },
      {
        id: "m4",
        senderId: "provider",
        text: "Thank you for your inquiry. We'd love to schedule a tour!",
        timestamp: "10:40 AM",
        isOwn: false,
      },
    ],
  },
  {
    id: "conv2",
    participant: "Kefilwe Modise",
    participantImage: "https://api.dicebear.com/7.x/personas/svg?seed=Kefilwe",
    lastMessage: "I am available from Monday. Shall we arrange a meeting?",
    timestamp: "1h ago",
    unread: 0,
    messages: [
      {
        id: "m5",
        senderId: "parent",
        text: "Hi Kefilwe, I saw your profile on Kidcexcellence. I'm looking for a nanny for my 18-month-old son starting next month.",
        timestamp: "9:00 AM",
        isOwn: true,
      },
      {
        id: "m6",
        senderId: "provider",
        text: "Hello! Thank you for getting in touch. I would love to hear more about your son's needs. Are you looking for full-time or part-time care?",
        timestamp: "9:15 AM",
        isOwn: false,
      },
      {
        id: "m7",
        senderId: "parent",
        text: "Full-time, Monday to Friday. We live in Tlokweng area.",
        timestamp: "9:20 AM",
        isOwn: true,
      },
      {
        id: "m8",
        senderId: "provider",
        text: "I am available from Monday. Shall we arrange a meeting?",
        timestamp: "9:30 AM",
        isOwn: false,
      },
    ],
  },
  {
    id: "conv3",
    participant: "Dr. Mpho Ramodupi",
    participantImage: "https://api.dicebear.com/7.x/personas/svg?seed=Mpho",
    lastMessage: "Please bring your baby's vaccination card to the appointment.",
    timestamp: "Yesterday",
    unread: 0,
    messages: [
      {
        id: "m9",
        senderId: "parent",
        text: "Good afternoon Doctor, I would like to book a 6-month check-up for my baby.",
        timestamp: "Yesterday 2:00 PM",
        isOwn: true,
      },
      {
        id: "m10",
        senderId: "provider",
        text: "Good afternoon! We have availability this Friday at 10 AM or Monday at 2 PM. Which works better for you?",
        timestamp: "Yesterday 2:15 PM",
        isOwn: false,
      },
      {
        id: "m11",
        senderId: "parent",
        text: "Friday at 10 AM would be perfect.",
        timestamp: "Yesterday 2:20 PM",
        isOwn: true,
      },
      {
        id: "m12",
        senderId: "provider",
        text: "Please bring your baby's vaccination card to the appointment.",
        timestamp: "Yesterday 2:25 PM",
        isOwn: false,
      },
    ],
  },
];

export const TESTIMONIALS = [
  {
    id: "t1",
    name: "Mpho Dlamini",
    location: "Phakalane, Gaborone",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=MphoD",
    text: "Kidcexcellence made it so easy to find the perfect nursery for my twins. I compared three schools side by side, read real reviews, and even messaged the school directly through the app. My twins started at Sunshine ELC last term and they absolutely love it!",
    rating: 5,
    children: "Twins, age 3",
  },
  {
    id: "t2",
    name: "Refilwe Mokoena",
    location: "Gaborone West",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=Refilwe",
    text: "As a working mum, I needed a reliable nanny I could trust completely. Through Kidcexcellence I found Kefilwe who has been an absolute blessing for our family. The verified badge gave me confidence and she's been with us for 6 months now.",
    rating: 5,
    children: "Son, 18 months",
  },
  {
    id: "t3",
    name: "Kabo Sithole",
    location: "Francistown",
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=Kabo",
    text: "I was worried I wouldn't find good childcare options in Francistown but Kidcexcellence had excellent listings with Dr. Nneka's clinic and several great nurseries. The WhatsApp contact option made it super convenient to reach out directly.",
    rating: 5,
    children: "Daughter, 4 months",
  },
];

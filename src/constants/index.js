import {
  mobile,
  backend,
  creator,
  web,
  javascript,
  typescript,
  html,
  css,
  reactjs,
  redux,
  tailwind,
  nodejs,
  mongodb,
  git,
  figma,
  docker,
  meta,
  tesla,
  shopify,
  carrent,
  wavenet,
  khawaja,
  waste,
  hegemony,
  bubble,
  monopoly,
  chess,
  conflict,
  jobit,
  tripguide,
  threejs,
  beatbox,
  minerva,
  daum,
  buraq,
  gensler,
  debatespaces,
  slumml,
  mml,
  redditpaper,
  psych,
} from "../assets";

export const navLinks = [
  { id: "about", title: "About" },
  { id: "work", title: "Work" },
  { id: "contact", title: "Contact" },
];

const services = [
  { title: "Software Developer", icon: web },
  { title: "Machine Learning Engineer", icon: mobile },
  { title: "Political Scientist", icon: backend },
  { title: "Complexity Scientist", icon: creator },
];

const experiences = [
  {
    title: "Course Instructor",
    company_name: "Center for Future Global Leaders",
    icon: meta,
    iconBg: "#FFFFFF",
    date: "January 2025 - Present",
    points: [
      "Red-teamed educational chatbots over a 6-month project using intention obfuscation resulting in additional preventative measures being shipped, including an incident response policy and stricter model guardrails for security & age-appropriate designs intended for a 4-week online bootcamp with 500+ middle-schoolers.",
      "Independently designed an undergraduate robotics course for Hanyang for 2 cohorts of ~50 students covering hardware fundamentals, C code and simulations, ethics of AI and robotics, kinematics, and search algorithms.",
    ],
  },
  {
    title: "L2 Technical Support",
    company_name: "Minerva Project",
    icon: minerva,
    iconBg: "#FFFFFF",
    date: "May 2024 - May 2026",
    points: [
      "Triaged technical support issues for 3,000+ users on Minerva Project's proprietary videotelephony platform with median response times of ~43 seconds, whilst proactively monitoring Datadog's Pubsub and Licode server health and user connection metrics such as RTT, ping, IP, browser, OS details for critical live chat support.",
    ],
  },
  {
    title: "Residential Counselor",
    company_name: "Wharton Global Youth at UPenn",
    icon: shopify,
    iconBg: "#FFFFFF",
    date: "Summer 2024",
    points: [
      "Responded to unique circumstances like conflict mediations with urgency while maintaining compliance with protocol to maintain the well-being of a cohort of 30 students, as well as being on-call 24/7 for emergencies.",
    ],
  },
  {
    title: "Undergraduate Teaching Assistant",
    company_name: "Minerva University",
    icon: minerva,
    iconBg: "#FFFFFF",
    date: "September 2021 - May 2024",
    points: [
      "Assessed 84 students across 5 courses for daily written and video responses, graded Python projects and problem sets, and established trust with faculty, evidenced by promotions from SS51 - introductory Complex Systems, to CS110 - intermediate Data Structures & Algorithms, and CS152 - advanced Artificial Intelligence.",
      "Held weekly office hours employing a socratic format averaging 2 - 3 students per session providing personalized feedback and debugging Python code; participating students scored 10-20% higher overall.",
    ],
  },
];

const testimonials = [
  {
    testimonial: "I thought it was impossible to make a website as beautiful as our product, but Rick proved me wrong.",
    name: "Sara Lee",
    designation: "CFO",
    company: "Acme Co",
    image: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    testimonial: "I've never met a web developer who truly cares about their clients' success like Rick does.",
    name: "Chris Brown",
    designation: "COO",
    company: "DEF Corp",
    image: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    testimonial: "After Rick optimized our website, our traffic increased by 50%. We can't thank them enough!",
    name: "Lisa Wang",
    designation: "CTO",
    company: "456 Enterprises",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
  },
];

const projects = [
  {
    name: "Robotics 101",
    description: "A 13-unit full-stack web application built independently to deepen robotics expertise, featuring interactive physics simulations, canvas-based rendering for robot control, and a puzzle-validation engine. Built with Python, TypeScript, Next.js, React, and Tailwind CSS; deployed to production.",
    tags: [
      { name: "nextjs", color: "blue-text-gradient" },
      { name: "react", color: "green-text-gradient" },
      { name: "robotics", color: "pink-text-gradient" },
    ],
    image: jobit,
    source_code_link: "https://github.com/RaphaelKhalid",
  },
  {
    name: "Instance Segmentation on Aerial Slum Images",
    description: "Used QGIS to get satellite images of slums, creating an annotated dataset of 1,022 instances merged with iSAID. Fine-tuned a Faster R-CNN with ResNet-101 backbone and a Cascade R-CNN with ResNeXt-152 backbone using Detectron 2.",
    tags: [
      { name: "slums", color: "blue-text-gradient" },
      { name: "torch", color: "green-text-gradient" },
      { name: "machinelearning", color: "pink-text-gradient" },
    ],
    image: slumml,
    source_code_link: "https://drive.google.com/file/d/1n3MbnRve5zXM-yRi7PJOXz4bVbLFForH/view?usp=drive_link",
  },
  {
    name: "A Non-Proliferation Treaty for AI",
    description: "Blog post deep-diving into the Munich and Framework Conventions on AI, performing a literature review of AI governance frameworks, critiquing safety approaches, and proposing solutions towards a unifying framework for AI governance and regulation.",
    tags: [
      { name: "aigovernance", color: "blue-text-gradient" },
      { name: "policy", color: "green-text-gradient" },
      { name: "research", color: "pink-text-gradient" },
    ],
    image: conflict,
    source_code_link: "https://github.com/RaphaelKhalid",
  },
  {
    name: "Replication Paper: Medical Marijuana Legalization and Motor Vehicle Fatalities",
    description: "Replication of the paper 'A Replication of \"Marijuana medicalization and motor vehicle fatalities: a synthetic control group approach'.",
    tags: [
      { name: "R", color: "blue-text-gradient" },
      { name: "causalinference", color: "green-text-gradient" },
      { name: "syntheticcontrol", color: "pink-text-gradient" },
    ],
    image: mml,
    source_code_link: "https://drive.google.com/file/d/1Mwl-dVUWBQbSKpz2uwWV5hDuay-rg5w8/view?usp=drive_link",
  },
  {
    name: "The effect of parenting styles and exposure to deception under a reward-punishment paradigm on the rate of lying",
    description: "The present study investigates how the ability to deceive is influenced by parenting style under a reward-and-punishment paradigm for children aged between 2 and 4 years.",
    tags: [
      { name: "psychology", color: "blue-text-gradient" },
      { name: "mockstudy", color: "green-text-gradient" },
      { name: "research", color: "pink-text-gradient" },
    ],
    image: psych,
    source_code_link: "https://drive.google.com/file/d/1-AZh-H-xQinn-xJCOoEh8xwiOMsfnipy/view?usp=sharing",
  },
  {
    name: "Sentiment Analysis of News Subreddit Comments",
    description: "A brief look into the varying sentiments across r/news and r/worldnews, specifically following October 7th, using VADER and textblob.",
    tags: [
      { name: "politicalscience", color: "blue-text-gradient" },
      { name: "nlp", color: "green-text-gradient" },
      { name: "machinelearning", color: "pink-text-gradient" },
    ],
    image: redditpaper,
    source_code_link: "https://drive.google.com/file/d/1SMcLEZ17I7rw9c_mj24EAfpLjrlH367m/view?usp=drive_link",
  },
  {
    name: "Live Beatbox Classifier",
    description: "A real time beatbox classifier that uses a convolutional neural network to classify beatbox sounds. The model was trained on 5 classes of beatbox sounds, built using tensorflow.",
    tags: [
      { name: "python", color: "blue-text-gradient" },
      { name: "tensorflow", color: "green-text-gradient" },
      { name: "machinelearning", color: "pink-text-gradient" },
    ],
    image: beatbox,
    source_code_link: "https://github.com/RaphaelKhalid/Python/tree/main/Live%20Audio%20Classifier%20with%20CNNs%20for%20Beatbox",
  },
  {
    name: "Replicating Google Wavenets",
    description: "An extension of the beatbox classifier, this project uses a wavenet architecture to generate novel sounds, trained on my own beatbox samples.",
    tags: [
      { name: "python", color: "blue-text-gradient" },
      { name: "tensorflow", color: "green-text-gradient" },
      { name: "generativeaudio", color: "pink-text-gradient" },
    ],
    image: wavenet,
    source_code_link: "https://drive.google.com/file/d/1pCqwpuC8xM4Mxc_ufunzxWLG8bU4n_bE/view?usp=sharing",
  },
  {
    name: "Khawaja Sira - A Complexity Approach",
    description: "A research paper on the Khawaja Sira community in Pakistan demonstrating the aggregation of mental models into ideologies, using Ostrom's ADICO syntax for rule categorization, and visualizing causal relations between both.",
    tags: [
      { name: "complexity", color: "blue-text-gradient" },
      { name: "causality", color: "green-text-gradient" },
      { name: "politicalscience", color: "pink-text-gradient" },
    ],
    image: khawaja,
    source_code_link: "https://drive.google.com/file/d/1mUFbG2ObSiok4ZHjtUuutQ5Kx47gPdNc/view?usp=sharing",
  },
  {
    name: "Modeling Complex Systems - Waste Collection",
    description: "An implementation of a waste-collection system in Python using NetworkX. A Monte Carlo search is compared with other strategies on the metrics of fuel efficiency.",
    tags: [
      { name: "python", color: "blue-text-gradient" },
      { name: "simulations", color: "green-text-gradient" },
      { name: "networkx", color: "pink-text-gradient" },
    ],
    image: waste,
    source_code_link: "https://drive.google.com/file/d/1aHRyuxobHT3GT39-MNwFL5fTLs26FnHs/view?usp=sharing",
  },
  {
    name: "A System Dynamics Approach to Hegemonic Theory",
    description: "A research paper developing a quantitative basis supporting the thesis that the balance of power is shifting towards multipolarity, using 3-dimensional phase spaces to predict US and China growth trajectories.",
    tags: [
      { name: "complexity", color: "blue-text-gradient" },
      { name: "systemdynamics", color: "green-text-gradient" },
      { name: "politicalscience", color: "pink-text-gradient" },
    ],
    image: hegemony,
    source_code_link: "https://drive.google.com/file/d/1VVsRwBbYCj8BuZ8oeXB1XxpPKQbs23mV/view?usp=sharing",
  },
  {
    name: "Housing Bubble in Turkey",
    description: "This paper presents evidence for a housing bubble in Turkey, supported by novel arguments about the contagion of conformity (simulated with NetLogo), economic analysis of systemic risk, business cycles, and monetary policy.",
    tags: [
      { name: "economics", color: "blue-text-gradient" },
      { name: "networks", color: "green-text-gradient" },
      { name: "netlogo", color: "pink-text-gradient" },
    ],
    image: bubble,
    source_code_link: "https://drive.google.com/file/d/1R9XF_3Yak5ajcmvEthjr2mAzhzRHdlbY/view?usp=sharing",
  },
  {
    name: "Multilayer Networks to Analyze Monopoly Power",
    description: "This research paper uses multilayer networks to consider Meta's social media monopoly from novel perspectives introduced by network theory.",
    tags: [
      { name: "economics", color: "blue-text-gradient" },
      { name: "networks", color: "green-text-gradient" },
      { name: "research", color: "pink-text-gradient" },
    ],
    image: monopoly,
    source_code_link: "https://drive.google.com/file/d/1BnQ3PqWDanh213NLP57V93Db6IjH8ol0/view?usp=sharing",
  },
  {
    name: "Classical Chess Engine",
    description: "Inspired by my passion for Chess, this project implements the classical chess engine algorithm: minimax, with subsequent optimizations including alpha-beta pruning and the Negamax algorithm.",
    tags: [
      { name: "python", color: "blue-text-gradient" },
      { name: "pygame", color: "green-text-gradient" },
      { name: "chess", color: "pink-text-gradient" },
    ],
    image: chess,
    source_code_link: "https://drive.google.com/file/d/11z8VYY05OapTW_UYkTvDLS1ncze-JTrm/view?usp=sharing",
  },
  {
    name: "Reconciling Disparate Conflicts - Kashmir and Israel-Palestine",
    description: "This research paper compares the Kashmir and Israel-Palestine conflict to garner theoretical similarities and differences across formal and informal rules, governmental agents, and bureaucratic governance factors.",
    tags: [
      { name: "conflict", color: "blue-text-gradient" },
      { name: "networks", color: "green-text-gradient" },
      { name: "research", color: "pink-text-gradient" },
    ],
    image: conflict,
    source_code_link: "https://drive.google.com/file/d/1NAAxodp0dd6vLu--WMw-T8w7_wEHG5Rz/view",
  },
];

export { services, experiences, testimonials, projects };
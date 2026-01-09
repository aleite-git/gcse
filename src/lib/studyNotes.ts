// Study notes for GCSE Computer Science topics

export interface StudyNote {
  topic: string;
  title: string;
  sections: {
    heading: string;
    content: string;
    bullets?: string[];
  }[];
}

export const studyNotes: Record<string, StudyNote> = {
  CPU: {
    topic: 'CPU',
    title: 'Central Processing Unit (CPU)',
    sections: [
      {
        heading: 'What is the CPU?',
        content: 'The CPU (Central Processing Unit) is the "brain" of the computer. It processes instructions and performs calculations.',
        bullets: [
          'Located on the motherboard',
          'Executes program instructions',
          'Performs billions of calculations per second',
        ],
      },
      {
        heading: 'Components of the CPU',
        content: 'The CPU has three main components:',
        bullets: [
          'ALU (Arithmetic Logic Unit) - performs mathematical calculations (+, -, ×, ÷) and logical operations (AND, OR, NOT)',
          'Control Unit (CU) - coordinates all CPU activities, fetches and decodes instructions',
          'Registers - tiny, ultra-fast storage locations inside the CPU for temporary data',
        ],
      },
      {
        heading: 'Key Registers',
        content: 'Important registers you need to know:',
        bullets: [
          'Program Counter (PC) - holds the address of the next instruction',
          'Accumulator (ACC) - stores results of calculations',
          'Memory Address Register (MAR) - holds the address being accessed',
          'Memory Data Register (MDR) - holds data being transferred',
          'Current Instruction Register (CIR) - holds the current instruction',
        ],
      },
      {
        heading: 'The Fetch-Decode-Execute Cycle',
        content: 'The CPU continuously repeats this cycle:',
        bullets: [
          'FETCH: Get the next instruction from memory (address in PC)',
          'DECODE: The Control Unit interprets the instruction',
          'EXECUTE: The ALU carries out the instruction',
          'The PC is incremented to point to the next instruction',
        ],
      },
      {
        heading: 'CPU Performance Factors',
        content: 'What affects CPU speed:',
        bullets: [
          'Clock Speed (GHz) - how many cycles per second',
          'Number of Cores - more cores = more parallel processing',
          'Cache Size - larger cache = faster data access',
        ],
      },
    ],
  },

  RAM_ROM: {
    topic: 'RAM_ROM',
    title: 'RAM and ROM',
    sections: [
      {
        heading: 'RAM (Random Access Memory)',
        content: 'RAM is volatile memory used for temporary storage while the computer is running.',
        bullets: [
          'Volatile - loses data when power is off',
          'Read and write capable',
          'Stores running programs and data',
          'Faster than secondary storage',
          'More RAM = more programs can run simultaneously',
        ],
      },
      {
        heading: 'ROM (Read Only Memory)',
        content: 'ROM is non-volatile memory that stores permanent instructions.',
        bullets: [
          'Non-volatile - keeps data when power is off',
          'Generally read-only (cannot be easily changed)',
          'Stores the BIOS/boot instructions',
          'Contains firmware',
          'Smaller capacity than RAM',
        ],
      },
      {
        heading: 'Key Differences',
        content: 'Comparing RAM and ROM:',
        bullets: [
          'RAM is volatile; ROM is non-volatile',
          'RAM can be written to; ROM is read-only',
          'RAM stores temporary data; ROM stores permanent instructions',
          'RAM is faster; ROM is slower',
          'RAM capacity is typically larger; ROM is smaller',
        ],
      },
      {
        heading: 'Virtual Memory',
        content: 'When RAM is full, the OS uses virtual memory:',
        bullets: [
          'Part of the hard drive acts as extra RAM',
          'Slower than actual RAM',
          'Allows running more programs than RAM would allow',
          'Data is swapped between RAM and virtual memory',
        ],
      },
    ],
  },

  Storage: {
    topic: 'Storage',
    title: 'Secondary Storage',
    sections: [
      {
        heading: 'Why Secondary Storage?',
        content: 'Secondary storage is needed because RAM is volatile.',
        bullets: [
          'Stores data permanently (non-volatile)',
          'Larger capacity than RAM',
          'Slower than RAM but persistent',
          'Stores OS, programs, and user files',
        ],
      },
      {
        heading: 'Magnetic Storage (HDD)',
        content: 'Hard Disk Drives use magnetism to store data:',
        bullets: [
          'Spinning platters with magnetic coating',
          'Read/write heads move across platters',
          'High capacity, low cost per GB',
          'Slower than SSD, moving parts can fail',
          'Good for: Large file storage, backups',
        ],
      },
      {
        heading: 'Solid State Storage (SSD)',
        content: 'SSDs use flash memory with no moving parts:',
        bullets: [
          'No moving parts - more durable',
          'Much faster read/write speeds',
          'More expensive per GB than HDD',
          'Lower capacity at same price point',
          'Good for: Operating systems, frequently accessed files',
        ],
      },
      {
        heading: 'Optical Storage',
        content: 'CDs, DVDs, and Blu-rays use lasers:',
        bullets: [
          'CD: ~700MB, DVD: ~4.7GB, Blu-ray: ~25GB',
          'Cheap and portable',
          'Slow read/write speeds',
          'Can be scratched/damaged',
          'Good for: Music, movies, software distribution',
        ],
      },
      {
        heading: 'Cloud Storage',
        content: 'Data stored on remote servers via the internet:',
        bullets: [
          'Accessible from anywhere with internet',
          'Automatic backups possible',
          'Requires internet connection',
          'Privacy/security concerns',
          'Monthly subscription costs',
        ],
      },
    ],
  },

  OS: {
    topic: 'OS',
    title: 'Operating Systems',
    sections: [
      {
        heading: 'What is an Operating System?',
        content: 'An OS is software that manages computer hardware and provides services for programs.',
        bullets: [
          'Acts as intermediary between user and hardware',
          'Examples: Windows, macOS, Linux, Android, iOS',
          'Loaded into RAM when computer starts',
        ],
      },
      {
        heading: 'Key Functions of an OS',
        content: 'The operating system handles:',
        bullets: [
          'Process Management - running multiple programs',
          'Memory Management - allocating RAM to programs',
          'File Management - organizing files and folders',
          'User Interface - GUI or command line',
          'Security - user accounts, passwords, permissions',
          'Device Drivers - communicating with hardware',
        ],
      },
      {
        heading: 'Multitasking',
        content: 'Running multiple programs "simultaneously":',
        bullets: [
          'CPU rapidly switches between tasks',
          'Each task gets a time slice',
          'Appears simultaneous to the user',
          'Requires process scheduling',
        ],
      },
      {
        heading: 'User Interfaces',
        content: 'How users interact with the OS:',
        bullets: [
          'GUI (Graphical User Interface) - windows, icons, menus',
          'CLI (Command Line Interface) - text commands',
          'GUI is easier for beginners; CLI is more powerful',
        ],
      },
      {
        heading: 'Utility Software',
        content: 'System tools that help maintain the computer:',
        bullets: [
          'Antivirus - protects against malware',
          'Disk Defragmenter - reorganizes HDD data',
          'Backup Software - copies important files',
          'File Compression - reduces file sizes',
        ],
      },
    ],
  },

  Software: {
    topic: 'Software',
    title: 'Software Types',
    sections: [
      {
        heading: 'System Software',
        content: 'Software that operates and controls the computer:',
        bullets: [
          'Operating Systems (Windows, macOS, Linux)',
          'Device Drivers - allow OS to communicate with hardware',
          'Utility Programs - maintenance tools',
          'Runs in the background',
        ],
      },
      {
        heading: 'Application Software',
        content: 'Software designed for end users to perform tasks:',
        bullets: [
          'Word Processors (Microsoft Word)',
          'Spreadsheets (Excel)',
          'Web Browsers (Chrome, Firefox)',
          'Games and entertainment',
          'Designed for specific purposes',
        ],
      },
      {
        heading: 'Open Source vs Proprietary',
        content: 'Two models of software distribution:',
        bullets: [
          'Open Source: Source code is freely available, can be modified (e.g., Linux)',
          'Proprietary: Source code is secret, owned by company (e.g., Windows)',
          'Open source is usually free; proprietary often costs money',
        ],
      },
    ],
  },

  Embedded: {
    topic: 'Embedded',
    title: 'Embedded Systems',
    sections: [
      {
        heading: 'What is an Embedded System?',
        content: 'A computer system built into a larger device for a specific purpose.',
        bullets: [
          'Dedicated to one function or set of functions',
          'Often runs continuously without user intervention',
          'Usually has limited or no user interface',
        ],
      },
      {
        heading: 'Examples of Embedded Systems',
        content: 'Found in everyday devices:',
        bullets: [
          'Washing machines - control wash cycles',
          'Traffic lights - manage timing sequences',
          'Central heating - temperature control',
          'Car engine management systems',
          'Smart watches and fitness trackers',
          'TV remote controls',
        ],
      },
      {
        heading: 'Characteristics',
        content: 'Key features of embedded systems:',
        bullets: [
          'Low power consumption',
          'Small physical size',
          'Limited processing power (only what\'s needed)',
          'Highly reliable - must work consistently',
          'Often no operating system (or very basic one)',
          'Programmed once, rarely updated',
        ],
      },
    ],
  },

  NetworksBasics: {
    topic: 'NetworksBasics',
    title: 'Network Fundamentals',
    sections: [
      {
        heading: 'What is a Network?',
        content: 'Two or more computers connected to share data and resources.',
        bullets: [
          'Allows file and printer sharing',
          'Enables communication (email, messaging)',
          'Provides internet access',
        ],
      },
      {
        heading: 'Network Types',
        content: 'Networks are classified by size:',
        bullets: [
          'LAN (Local Area Network) - small area like a building',
          'WAN (Wide Area Network) - large geographical area',
          'The Internet is the largest WAN',
          'PAN (Personal Area Network) - very small, e.g., Bluetooth devices',
        ],
      },
      {
        heading: 'Network Hardware',
        content: 'Devices needed for networking:',
        bullets: [
          'Router - directs traffic between networks, assigns IP addresses',
          'Switch - connects devices in a LAN, sends data to correct device',
          'NIC (Network Interface Card) - allows device to connect to network',
          'WAP (Wireless Access Point) - enables WiFi connections',
          'Modem - converts digital to analogue signals for phone lines',
        ],
      },
      {
        heading: 'Network Topologies',
        content: 'How devices are arranged in a network:',
        bullets: [
          'Star - all devices connect to central switch/hub (most common)',
          'Bus - all devices share one cable (older, simple)',
          'Ring - devices form a circle (token passing)',
          'Mesh - devices interconnected (reliable but expensive)',
        ],
      },
      {
        heading: 'Client-Server vs Peer-to-Peer',
        content: 'Two network models:',
        bullets: [
          'Client-Server: Central server provides resources; clients request them',
          'Peer-to-Peer: All computers are equal, share directly',
          'Client-Server: Better security, central management',
          'Peer-to-Peer: Simpler, cheaper, no central point of failure',
        ],
      },
      {
        heading: 'Transmission Media',
        content: 'How data travels across networks:',
        bullets: [
          'Ethernet Cable - copper wires, common in LANs',
          'Fibre Optic - light pulses, very fast, long distance',
          'Wireless (WiFi) - radio waves, convenient but less secure',
        ],
      },
    ],
  },

  Protocols: {
    topic: 'Protocols',
    title: 'Network Protocols',
    sections: [
      {
        heading: 'What is a Protocol?',
        content: 'A set of rules that govern how data is transmitted over a network.',
        bullets: [
          'Ensures devices can communicate',
          'Defines format of messages',
          'Handles errors and security',
        ],
      },
      {
        heading: 'TCP/IP',
        content: 'The fundamental protocol suite of the internet:',
        bullets: [
          'TCP (Transmission Control Protocol) - ensures reliable delivery',
          'IP (Internet Protocol) - handles addressing and routing',
          'TCP breaks data into packets, ensures all arrive',
          'IP addresses identify devices on a network',
        ],
      },
      {
        heading: 'HTTP and HTTPS',
        content: 'Protocols for web browsing:',
        bullets: [
          'HTTP (HyperText Transfer Protocol) - transfers web pages',
          'HTTPS - secure version with encryption',
          'HTTPS uses SSL/TLS to encrypt data',
          'Always use HTTPS for sensitive information',
        ],
      },
      {
        heading: 'Other Important Protocols',
        content: 'Common protocols you should know:',
        bullets: [
          'FTP (File Transfer Protocol) - uploading/downloading files',
          'SMTP (Simple Mail Transfer Protocol) - sending emails',
          'POP3/IMAP - receiving emails',
          'DNS (Domain Name System) - converts domain names to IP addresses',
          'DHCP - automatically assigns IP addresses',
        ],
      },
      {
        heading: 'IP Addresses',
        content: 'Unique identifiers for devices on a network:',
        bullets: [
          'IPv4: e.g., 192.168.1.1 (32-bit, ~4 billion addresses)',
          'IPv6: e.g., 2001:0db8:85a3::8a2e:0370:7334 (128-bit)',
          'IPv6 created because IPv4 addresses running out',
          'Private IPs for local networks; Public IPs for internet',
        ],
      },
      {
        heading: 'MAC Addresses',
        content: 'Physical hardware addresses:',
        bullets: [
          'Unique to each network interface card',
          'Assigned by manufacturer',
          'Used for local network communication',
          'Format: 00:1A:2B:3C:4D:5E',
        ],
      },
      {
        heading: 'Packet Switching',
        content: 'How data travels across the internet:',
        bullets: [
          'Data is split into packets',
          'Each packet can take a different route',
          'Packets reassembled at destination',
          'More efficient than circuit switching',
          'Packet contains: source IP, destination IP, data, sequence number',
        ],
      },
    ],
  },

  Security: {
    topic: 'Security',
    title: 'Network Security',
    sections: [
      {
        heading: 'Types of Threats',
        content: 'Common security threats:',
        bullets: [
          'Malware - malicious software (viruses, trojans, ransomware)',
          'Phishing - fake emails/websites to steal credentials',
          'Hacking - unauthorized access to systems',
          'DDoS Attacks - overwhelming servers with traffic',
          'SQL Injection - exploiting database vulnerabilities',
          'Social Engineering - manipulating people to reveal information',
        ],
      },
      {
        heading: 'Types of Malware',
        content: 'Different categories of malicious software:',
        bullets: [
          'Virus - attaches to files, spreads when file is shared',
          'Worm - self-replicating, spreads across networks',
          'Trojan - disguised as legitimate software',
          'Ransomware - encrypts files, demands payment',
          'Spyware - secretly monitors user activity',
          'Adware - displays unwanted advertisements',
        ],
      },
      {
        heading: 'Protection Methods',
        content: 'How to stay secure:',
        bullets: [
          'Antivirus/Anti-malware software',
          'Firewalls - monitor and filter network traffic',
          'Strong passwords - long, complex, unique',
          'Two-factor authentication (2FA)',
          'Regular software updates',
          'Encryption for sensitive data',
          'Regular backups',
        ],
      },
      {
        heading: 'Encryption',
        content: 'Protecting data by encoding it:',
        bullets: [
          'Converts plaintext to ciphertext',
          'Requires a key to decrypt',
          'Symmetric encryption - same key to encrypt/decrypt',
          'Asymmetric encryption - public and private keys',
          'Used in HTTPS, email, file storage',
        ],
      },
      {
        heading: 'Firewalls',
        content: 'Network security systems:',
        bullets: [
          'Monitors incoming and outgoing traffic',
          'Blocks unauthorized access',
          'Can be hardware or software',
          'Uses rules to allow/deny traffic',
        ],
      },
      {
        heading: 'Authentication',
        content: 'Verifying user identity:',
        bullets: [
          'Something you know - password, PIN',
          'Something you have - phone, smart card',
          'Something you are - fingerprint, face recognition',
          'Multi-factor uses two or more of these',
        ],
      },
    ],
  },

  DataRepresentation: {
    topic: 'DataRepresentation',
    title: 'Data Representation',
    sections: [
      {
        heading: 'Binary (Base 2)',
        content: 'Computers use binary - only 0s and 1s:',
        bullets: [
          'Each digit is a BIT (Binary digIT)',
          '8 bits = 1 byte',
          'Place values: 128, 64, 32, 16, 8, 4, 2, 1',
          'Example: 10110101 = 128+32+16+4+1 = 181',
        ],
      },
      {
        heading: 'Hexadecimal (Base 16)',
        content: 'A shorthand for binary:',
        bullets: [
          'Uses 0-9 and A-F (A=10, B=11... F=15)',
          '4 binary bits = 1 hex digit',
          'Used for colours, MAC addresses, memory addresses',
          'Example: FF = 11111111 = 255',
        ],
      },
      {
        heading: 'Binary Arithmetic',
        content: 'Adding binary numbers:',
        bullets: [
          '0 + 0 = 0',
          '0 + 1 = 1',
          '1 + 0 = 1',
          '1 + 1 = 10 (carry the 1)',
          'Overflow occurs when result exceeds available bits',
        ],
      },
      {
        heading: 'Binary Shifts',
        content: 'Moving bits left or right:',
        bullets: [
          'Left shift: multiply by 2 for each shift',
          'Right shift: divide by 2 for each shift',
          'Example: 00001010 << 1 = 00010100 (10 becomes 20)',
        ],
      },
      {
        heading: 'Character Encoding',
        content: 'How text is stored:',
        bullets: [
          'ASCII - 7 bits, 128 characters (English only)',
          'Extended ASCII - 8 bits, 256 characters',
          'Unicode - up to 32 bits, all world languages',
          'Each character has a unique code',
        ],
      },
      {
        heading: 'Images',
        content: 'How images are stored digitally:',
        bullets: [
          'Made up of pixels',
          'Resolution = width × height in pixels',
          'Colour depth = bits per pixel',
          'Higher resolution and colour depth = larger file',
          'File size = width × height × colour depth',
        ],
      },
      {
        heading: 'Sound',
        content: 'How sound is stored digitally:',
        bullets: [
          'Analogue sound is sampled at intervals',
          'Sample rate = samples per second (Hz)',
          'Bit depth = bits per sample',
          'Higher sample rate and bit depth = better quality',
          'File size = sample rate × bit depth × duration',
        ],
      },
      {
        heading: 'Compression',
        content: 'Reducing file sizes:',
        bullets: [
          'Lossy - permanently removes data (MP3, JPEG)',
          'Lossless - no data lost, fully reversible (ZIP, PNG)',
          'Lossy = smaller files, lower quality',
          'Lossless = larger files, original quality',
        ],
      },
    ],
  },

  Performance: {
    topic: 'Performance',
    title: 'System Performance',
    sections: [
      {
        heading: 'CPU Performance Factors',
        content: 'What affects how fast a CPU processes:',
        bullets: [
          'Clock Speed (GHz) - cycles per second',
          'Number of Cores - parallel processing capability',
          'Cache Size - fast memory on the CPU',
          'Architecture - 32-bit vs 64-bit',
        ],
      },
      {
        heading: 'Clock Speed',
        content: 'Measured in Hertz (Hz):',
        bullets: [
          '1 GHz = 1 billion cycles per second',
          'Higher clock speed = faster processing',
          'Limited by heat generation',
          'Can be overclocked (increases heat)',
        ],
      },
      {
        heading: 'Cores',
        content: 'Multiple processing units in one CPU:',
        bullets: [
          'Dual-core = 2 cores, Quad-core = 4 cores',
          'Each core can execute instructions independently',
          'Better for multitasking',
          'Software must be designed to use multiple cores',
        ],
      },
      {
        heading: 'Cache Memory',
        content: 'Ultra-fast memory on the CPU:',
        bullets: [
          'L1 Cache - smallest, fastest, closest to cores',
          'L2 Cache - larger, slightly slower',
          'L3 Cache - largest, shared between cores',
          'Stores frequently used data and instructions',
        ],
      },
      {
        heading: 'RAM Impact',
        content: 'How RAM affects performance:',
        bullets: [
          'More RAM = more programs can run simultaneously',
          'Insufficient RAM = system uses slow virtual memory',
          'RAM speed also affects performance',
          'DDR4 faster than DDR3',
        ],
      },
      {
        heading: 'Storage Impact',
        content: 'How storage affects performance:',
        bullets: [
          'SSD much faster than HDD',
          'Affects boot time and program loading',
          'Full drives slow down the system',
          'Fragmented HDDs are slower (defragment to fix)',
        ],
      },
    ],
  },

  Hardware: {
    topic: 'Hardware',
    title: 'Computer Hardware',
    sections: [
      {
        heading: 'What is Hardware?',
        content: 'Physical components of a computer system.',
        bullets: [
          'Can be touched and seen',
          'Works with software to perform tasks',
          'Internal and external components',
        ],
      },
      {
        heading: 'Input Devices',
        content: 'Devices that send data INTO the computer:',
        bullets: [
          'Keyboard - text input',
          'Mouse - pointing and clicking',
          'Microphone - audio input',
          'Scanner - converts physical documents to digital',
          'Webcam - video input',
          'Touchscreen - touch input',
        ],
      },
      {
        heading: 'Output Devices',
        content: 'Devices that receive data FROM the computer:',
        bullets: [
          'Monitor - displays visual output',
          'Printer - produces physical copies',
          'Speakers - audio output',
          'Projector - displays on large surface',
        ],
      },
      {
        heading: 'Internal Components',
        content: 'Components inside the computer case:',
        bullets: [
          'CPU - processes instructions',
          'Motherboard - connects all components',
          'RAM - temporary memory',
          'GPU (Graphics Card) - processes graphics',
          'PSU (Power Supply Unit) - provides electricity',
          'Storage devices (HDD, SSD)',
        ],
      },
      {
        heading: 'Motherboard',
        content: 'The main circuit board:',
        bullets: [
          'All components connect to it',
          'Contains slots for RAM, CPU, expansion cards',
          'Has ports for external devices',
          'Contains the BIOS chip',
        ],
      },
    ],
  },

  Ethics_Law_Env: {
    topic: 'Ethics_Law_Env',
    title: 'Ethics, Law & Environment',
    sections: [
      {
        heading: 'Data Protection Act (DPA) / GDPR',
        content: 'Laws protecting personal data:',
        bullets: [
          'Personal data must be processed fairly and lawfully',
          'Collected for specific purposes only',
          'Must be accurate and kept up to date',
          'Not kept longer than necessary',
          'Protected against unauthorized access',
          'Individuals have right to access their data',
        ],
      },
      {
        heading: 'Computer Misuse Act',
        content: 'Laws against computer crime:',
        bullets: [
          'Unauthorized access to computer systems (hacking)',
          'Unauthorized access with intent to commit crime',
          'Unauthorized modification of data',
          'Making or supplying hacking tools',
          'Penalties include fines and imprisonment',
        ],
      },
      {
        heading: 'Copyright',
        content: 'Protecting creative works:',
        bullets: [
          'Automatically protects original work',
          'Includes software, music, images, text',
          'Illegal to copy without permission',
          'Creative Commons offers alternative licensing',
          'Open source software has specific licenses',
        ],
      },
      {
        heading: 'Ethical Issues',
        content: 'Moral considerations in computing:',
        bullets: [
          'Privacy - how much data should be collected?',
          'Surveillance - CCTV, tracking, monitoring',
          'AI and automation - job displacement',
          'Digital divide - unequal access to technology',
          'Fake news and misinformation',
          'Cyberbullying and online harassment',
        ],
      },
      {
        heading: 'Environmental Impact',
        content: 'How computing affects the environment:',
        bullets: [
          'E-waste - discarded electronics',
          'Energy consumption of data centres',
          'Manufacturing uses rare earth materials',
          'Carbon footprint of streaming/cloud services',
        ],
      },
      {
        heading: 'Reducing Environmental Impact',
        content: 'Ways to be more sustainable:',
        bullets: [
          'Recycle old electronics properly',
          'Use energy-efficient devices',
          'Extend device lifespan',
          'Use renewable energy for data centres',
          'Reduce unnecessary data storage',
        ],
      },
      {
        heading: 'Health Issues',
        content: 'Physical problems from computer use:',
        bullets: [
          'RSI (Repetitive Strain Injury)',
          'Eye strain from screens',
          'Back and neck problems from poor posture',
          'Solutions: ergonomic equipment, regular breaks',
        ],
      },
    ],
  },

  // Biology Study Notes
  'Bioenergetics': {
    topic: 'Bioenergetics',
    title: 'Bioenergetics – Photosynthesis and Respiration',
    sections: [
      {
        heading: 'Photosynthesis',
        content: 'Photosynthesis is the process by which plants make glucose using light energy. It takes place in chloroplasts.',
        bullets: [
          'Word equation: carbon dioxide + water → glucose + oxygen',
          'Uses light energy absorbed by chlorophyll',
          'Rate affected by light intensity, carbon dioxide concentration, and temperature',
        ],
      },
      {
        heading: 'Respiration',
        content: 'Respiration releases energy from glucose. It occurs in all living cells.',
        bullets: [
          'Aerobic: glucose + oxygen → carbon dioxide + water',
          'Anaerobic (animals): glucose → lactic acid',
          'Anaerobic (plants/yeast): glucose → ethanol + carbon dioxide',
        ],
      },
    ],
  },

  'Cell biology': {
    topic: 'Cell biology',
    title: 'Cell Biology – Structure and Transport',
    sections: [
      {
        heading: 'Cell Structure',
        content: 'Cells are the basic building blocks of life. Different cell types have different structures.',
        bullets: [
          'Nucleus controls activities and contains DNA',
          'Mitochondria release energy by respiration',
          'Ribosomes make proteins',
          'Plant cells have a cell wall, chloroplasts, and a permanent vacuole',
        ],
      },
      {
        heading: 'Transport in Cells',
        content: 'Substances move in and out of cells by diffusion, osmosis, or active transport.',
        bullets: [
          'Diffusion: movement from high to low concentration',
          'Osmosis: diffusion of water through a partially permeable membrane',
          'Active transport: movement against concentration gradient using energy',
        ],
      },
    ],
  },

  'Ecology': {
    topic: 'Ecology',
    title: 'Ecology – Ecosystems and Energy Transfer',
    sections: [
      {
        heading: 'Ecosystems',
        content: 'An ecosystem is the interaction between living organisms and their environment.',
        bullets: [
          'Producers make their own food (plants)',
          'Consumers eat other organisms',
          'Decomposers break down dead material and recycle nutrients',
        ],
      },
      {
        heading: 'Energy Transfer',
        content: 'Energy is transferred through food chains and webs but is lost at each stage.',
        bullets: [
          'Energy lost as heat during respiration',
          'Only about 10% of energy is transferred to the next trophic level',
          'Biomass decreases at higher trophic levels',
        ],
      },
    ],
  },

  'Homeostasis and response': {
    topic: 'Homeostasis and response',
    title: 'Homeostasis and Response – Control Systems',
    sections: [
      {
        heading: 'Homeostasis',
        content: 'Homeostasis maintains a stable internal environment.',
        bullets: [
          'Controls body temperature, blood glucose, and water balance',
          'Uses negative feedback',
          'Involves nervous and hormonal systems',
        ],
      },
      {
        heading: 'Blood Glucose Control',
        content: 'Blood glucose is controlled by insulin and glucagon.',
        bullets: [
          'Insulin lowers blood glucose',
          'Glucagon raises blood glucose',
          'Produced by the pancreas',
        ],
      },
    ],
  },

  'Inheritance, variation and evolution': {
    topic: 'Inheritance, variation and evolution',
    title: 'Inheritance, Variation and Evolution – Genetics Basics',
    sections: [
      {
        heading: 'Genes and Inheritance',
        content: 'Genetic information is carried in DNA and genes.',
        bullets: [
          'Genes are sections of DNA',
          'Alleles are different versions of a gene',
          'Dominant alleles are expressed with one copy',
        ],
      },
      {
        heading: 'Evolution',
        content: 'Evolution occurs by natural selection.',
        bullets: [
          'Variation exists within populations',
          'Better-adapted organisms survive and reproduce',
          'Over time, advantageous alleles become more common',
        ],
      },
    ],
  },

  'Maths skills': {
    topic: 'Maths skills',
    title: 'Maths Skills in Biology',
    sections: [
      {
        heading: 'Calculations',
        content: 'Maths is used to analyse biological data.',
        bullets: [
          'Magnification = image size ÷ actual size',
          'Percentage change = (change ÷ original) × 100',
          'Mean = total ÷ number',
        ],
      },
      {
        heading: 'Units',
        content: 'Correct units are essential in calculations.',
        bullets: [
          'Length often measured in micrometres (µm)',
          'Volume in cm³ or dm³',
          'Temperature in °C',
        ],
      },
    ],
  },

  'Organisation': {
    topic: 'Organisation',
    title: 'Organisation – Cells to Systems',
    sections: [
      {
        heading: 'Levels of Organisation',
        content: 'Living organisms are organised into hierarchical levels.',
        bullets: [
          'Cells → Tissues → Organs → Organ systems → Organisms',
          'Tissues are groups of similar cells working together',
          'Organs contain different tissues working together',
        ],
      },
      {
        heading: 'Digestive System',
        content: 'The digestive system breaks down food for absorption.',
        bullets: [
          'Enzymes break down large molecules into smaller ones',
          'Amylase breaks down starch into sugars',
          'Proteases break down proteins into amino acids',
          'Lipases break down lipids into fatty acids and glycerol',
        ],
      },
    ],
  },

  'Required practicals': {
    topic: 'Required practicals',
    title: 'Required Practicals – Key Knowledge',
    sections: [
      {
        heading: 'Food Tests',
        content: 'Food tests identify biological molecules.',
        bullets: [
          'Starch: iodine turns blue-black',
          'Reducing sugars: Benedict\'s solution turns brick-red when heated',
          'Protein: Biuret turns purple',
          'Lipids: ethanol emulsion test gives cloudy white result',
        ],
      },
      {
        heading: 'Osmosis Practical',
        content: 'Osmosis is investigated using potato cylinders.',
        bullets: [
          'Measure change in mass',
          'Keep size of potato cylinders the same',
          'Use a range of sugar concentrations',
        ],
      },
    ],
  },

  'Working scientifically': {
    topic: 'Working scientifically',
    title: 'Working Scientifically – Investigations',
    sections: [
      {
        heading: 'Variables',
        content: 'Investigations must be planned carefully.',
        bullets: [
          'Independent variable: what you change',
          'Dependent variable: what you measure',
          'Control variables: what you keep the same',
        ],
      },
      {
        heading: 'Data and Reliability',
        content: 'Results must be reliable and valid.',
        bullets: [
          'Repeats improve reliability',
          'Anomalous results do not fit the pattern',
          'Large sample sizes reduce random error',
        ],
      },
    ],
  },
};

export function getStudyNotes(topic: string): StudyNote | undefined {
  return studyNotes[topic];
}

export function getAllTopics(): string[] {
  return Object.keys(studyNotes);
}

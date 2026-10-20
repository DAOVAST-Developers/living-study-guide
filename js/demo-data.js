/**
 * Demo Data for Living Study Guide
 * Contains:
 * 1. ~400 words of original notes on "How the internet and the web work (basics)"
 * 2. 8 pending sample cards (mix of flashcards & multiple-choice questions)
 *    - All cards have verbatim excerpts from the notes.
 *    - CARD 6 is deliberately flawed (adds an unmentioned cause not found in the excerpt)
 *      to let users test human review and verification. Marked ONLY in code comments.
 */

export const DEMO_SOURCE_TITLE = 'How the Internet and the Web Work (Basics)';

export const DEMO_SOURCE_TEXT = `The Internet is a global system of interconnected computer networks that communicate using standardized communication protocols. It forms the physical and logical highway over which countless distinct services operate. In contrast, the World Wide Web is one specific application service built on top of this infrastructure, consisting of interlinked multimedia documents accessed through web browsers.

When information travels across the Internet, it is broken down into small units called packets. Each packet contains a portion of the payload data along with header metadata specifying the sender and recipient IP addresses. Routers inspect each packet's destination address and dynamically forward it through intermediary networks toward its target. Because packets travel independently, they may take different physical paths across fiber-optic cables and undersea links before reaching the destination.

The Transmission Control Protocol, or TCP, works alongside the Internet Protocol to provide reliable delivery. TCP establishes a connection between devices using a multi-step handshake, verifies that every transmitted packet arrives without corruption, and reassembles out-of-order packets into the original sequence before handing the data to the target application.

Human beings rarely navigate by memorizing numerical IP addresses. Instead, the Domain Name System acts as the distributed directory of the Internet, translating human-readable hostnames into numerical IP addresses. When a user enters a web address, a DNS resolver queries root, top-level domain, and authoritative name servers to discover the server's numerical address.

Once the destination IP address is resolved, the client web browser establishes a TCP connection and issues a Hypertext Transfer Protocol request. The modern web predominantly uses HTTPS, which wraps standard HTTP traffic inside Transport Layer Security encryption to prevent eavesdropping and tampering by third parties along the transmission route.

To accelerate content delivery across long geographic distances, web architectures frequently deploy caching mechanisms and content delivery networks. Caches store static copies of images, stylesheets, and scripts at network edges closer to end users, significantly reducing round-trip latency and conserving backbone bandwidth.

Upon receiving the request, the web server processes the parameters and returns an HTTP response containing a numeric status code and the requested resource payload, typically an HTML document. The browser engine parses the HTML tokens into a structured Document Object Model tree, downloads referenced stylesheets and scripts, calculates layout geometry, and paints the rendered visual pixels onto the device screen.`;

export const DEMO_ITEMS = [
  {
    id: 'demo-item-1',
    concept: 'Internet vs. Web Architecture',
    type: 'flashcard',
    front: 'What is the fundamental difference between the Internet and the World Wide Web?',
    back: 'The Internet is the underlying global network of interconnected computers and protocols, while the World Wide Web is an application service built on top of it for accessing interlinked multimedia documents.',
    source_excerpt: 'The Internet is a global system of interconnected computer networks that communicate using standardized communication protocols. It forms the physical and logical highway over which countless distinct services operate. In contrast, the World Wide Web is one specific application service built on top of this infrastructure, consisting of interlinked multimedia documents accessed through web browsers.',
    tags: ['networking', 'architecture', 'fundamentals'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null // not run yet
    },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'demo-item-2',
    concept: 'Packet Switching',
    type: 'quiz',
    question: 'How does information travel across the Internet according to packet-switching principles?',
    options: [
      'Data is broken into discrete packets with header metadata and routed independently.',
      'A permanent physical circuit is locked between the two computers for the entire session.',
      'All data must travel sequentially through a single centralized routing hub in North America.',
      'Data streams are converted into analog radio waves without destination addresses.'
    ],
    answer: 'Data is broken into discrete packets with header metadata and routed independently.',
    explanation: 'Information is broken into small packets containing payload and header metadata (sender and recipient IP addresses), which routers inspect and forward dynamically.',
    source_excerpt: 'When information travels across the Internet, it is broken down into small units called packets. Each packet contains a portion of the payload data along with header metadata specifying the sender and recipient IP addresses.',
    tags: ['packets', 'networking'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 3.5).toISOString()
  },
  {
    id: 'demo-item-3',
    concept: 'Packet Routing',
    type: 'flashcard',
    front: 'Do all packets belonging to the same transmission travel along the identical physical path?',
    back: 'No. Because packets travel independently, routers dynamically forward them, and they may take different physical paths across cables and links before arriving.',
    source_excerpt: 'Because packets travel independently, they may take different physical paths across fiber-optic cables and undersea links before reaching the destination.',
    tags: ['routing', 'packets'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'demo-item-4',
    concept: 'Transport Layer Security & Protocols',
    type: 'quiz',
    question: 'What is the primary role of the Transmission Control Protocol (TCP) in data transmission?',
    options: [
      'Establishing a connection via handshake, verifying error-free delivery, and reassembling packets in order.',
      'Assigning brand-new permanent IP addresses to all connected household smart devices.',
      'Translating domain names into 128-bit cryptographic public keys.',
      'Rendering CSS stylesheets into GPU raster instructions.'
    ],
    answer: 'Establishing a connection via handshake, verifying error-free delivery, and reassembling packets in order.',
    explanation: 'TCP establishes a connection using a handshake, verifies packets arrive without corruption, and reassembles out-of-order packets before handing data to the application.',
    source_excerpt: 'TCP establishes a connection between devices using a multi-step handshake, verifies that every transmitted packet arrives without corruption, and reassembles out-of-order packets into the original sequence before handing the data to the target application.',
    tags: ['tcp', 'reliability', 'protocols'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 2.5).toISOString()
  },
  {
    id: 'demo-item-5',
    concept: 'Domain Name System (DNS)',
    type: 'flashcard',
    front: 'What role does the Domain Name System (DNS) play on the Internet?',
    back: 'It acts as the distributed directory of the Internet, translating human-readable hostnames into numerical IP addresses so users do not have to memorize numerical addresses.',
    source_excerpt: 'Instead, the Domain Name System acts as the distributed directory of the Internet, translating human-readable hostnames into numerical IP addresses.',
    tags: ['dns', 'addressing'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    /* 
     * DELIBERATELY FLAWED CARD:
     * Excerpt: "The modern web predominantly uses HTTPS, which wraps standard HTTP traffic inside Transport Layer Security encryption to prevent eavesdropping and tampering by third parties along the transmission route."
     * Flaw: The answer below introduces an unmentioned cause/claim:
     * It claims HTTPS was adopted "because the United Nations mandated it in 2014 under international telecommunications law".
     * That cause is completely fabricated and absent from the notes!
     * This card is intentional so the user can spot hallucinated claims and test the AI "Check against source" feature.
     */
    id: 'demo-item-6',
    concept: 'Web Security & Encryption',
    type: 'flashcard',
    front: 'Why does the modern web predominantly use HTTPS instead of standard HTTP?',
    back: 'Because standard HTTP was banned by the United Nations under 2014 international telecommunications treaties, requiring all websites to wrap traffic inside Transport Layer Security encryption to prevent third-party eavesdropping.',
    source_excerpt: 'The modern web predominantly uses HTTPS, which wraps standard HTTP traffic inside Transport Layer Security encryption to prevent eavesdropping and tampering by third parties along the transmission route.',
    tags: ['https', 'security', 'encryption'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString()
  },
  {
    id: 'demo-item-7',
    concept: 'Client-Server HTTP Cycle',
    type: 'quiz',
    question: 'What does a web server return to the client browser after receiving an HTTP request?',
    options: [
      'An HTTP response containing a numeric status code and the requested resource payload.',
      'A raw binary BIOS update that restarts the client machine automatically.',
      'An encrypted DNS root key that grants the browser administrative rights to the ISP.',
      'A physical acknowledgment token sent via postal mail.'
    ],
    answer: 'An HTTP response containing a numeric status code and the requested resource payload.',
    explanation: 'The server returns an HTTP response with a numeric status code (such as 200 OK) and the payload (typically an HTML document).',
    source_excerpt: 'Upon receiving the request, the web server processes the parameters and returns an HTTP response containing a numeric status code and the requested resource payload, typically an HTML document.',
    tags: ['http', 'client-server'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 1).toISOString()
  },
  {
    id: 'demo-item-8',
    concept: 'Browser Rendering Pipeline',
    type: 'flashcard',
    front: 'What does a browser engine do after parsing HTML tokens into a Document Object Model (DOM) tree?',
    back: 'It downloads referenced stylesheets and scripts, calculates layout geometry, and paints the rendered visual pixels onto the screen.',
    source_excerpt: 'The browser engine parses the HTML tokens into a structured Document Object Model tree, downloads referenced stylesheets and scripts, calculates layout geometry, and paints the rendered visual pixels onto the device screen.',
    tags: ['browser', 'rendering', 'dom'],
    status: 'pending',
    verification: {
      sourceMatch: 'verified',
      aiClaimCheck: null
    },
    created_at: new Date(Date.now() - 3600000 * 0.5).toISOString()
  }
];

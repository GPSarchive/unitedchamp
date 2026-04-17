import type { Metadata } from "next";
import Image from "next/image";
import VantaBg from "@/app/lib/VantaBg";

export const metadata: Metadata = {
  title: "Πολιτική Απορρήτου | UltraChamp.gr",
  description:
    "Πολιτική απορρήτου και προστασίας προσωπικών δεδομένων της πλατφόρμας UltraChamp.gr.",
};

export default function PrivacyPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      <div className="relative z-10">
        {/* ── Hero header ── */}
        <div className="flex flex-col items-center pt-8 pb-12 px-4">
          <div className="relative w-24 h-24 mb-4">
            <Image
              src="/UltraChampLogo.png"
              alt="UltraChamp Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-white tracking-tight">
            Πολιτική Απορρήτου
          </h1>
          <p className="mt-3 text-white/60 text-center max-w-lg text-sm sm:text-base">
            Πώς συλλέγουμε, χρησιμοποιούμε και προστατεύουμε τα δεδομένα σας.
          </p>
          <p className="mt-2 text-white/40 text-center text-xs">
            Τελευταία ενημέρωση: Απρίλιος 2026
          </p>
        </div>

        {/* ── Content ── */}
        <div className="container mx-auto px-4 pb-16 max-w-4xl">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-10 shadow-2xl">
            <div className="space-y-10">

              {/* 1. Εισαγωγή */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  1. Εισαγωγή
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Η <strong className="text-white">UltraChamp.gr</strong> («εμείς», «μας») είναι η ελληνική πλατφόρμα διοργάνωσης και διαχείρισης πρωταθλημάτων mini football (5x5, 6x6, 7x7). Η παρούσα Πολιτική Απορρήτου εξηγεί ποια προσωπικά δεδομένα συλλέγουμε όταν χρησιμοποιείτε την πλατφόρμα μας, πώς τα χρησιμοποιούμε και ποια δικαιώματα έχετε σχετικά με αυτά, σύμφωνα με τον Γενικό Κανονισμό Προστασίας Δεδομένων (GDPR — Κανονισμός ΕΕ 2016/679) και την ισχύουσα ελληνική νομοθεσία.
                </p>
                <p className="text-white/90 leading-relaxed mt-3">
                  Χρησιμοποιώντας την πλατφόρμα μας, αποδέχεστε τις πρακτικές που περιγράφονται στην παρούσα Πολιτική. Αν διαφωνείτε, παρακαλούμε μην χρησιμοποιείτε τις υπηρεσίες μας.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 2. Ποια δεδομένα συλλέγουμε */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  2. Ποια Δεδομένα Συλλέγουμε
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Κατά την εγγραφή σας και τη χρήση της πλατφόρμας, ενδέχεται να συλλέγουμε τις εξής κατηγορίες δεδομένων:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Στοιχεία λογαριασμού:</strong> Διεύθυνση email, κωδικός πρόσβασης (αποθηκεύεται κρυπτογραφημένος), όνομα χρήστη.</li>
                  <li><strong className="text-white">Προφίλ παίκτη:</strong> Πλήρες όνομα, ηλικία, φωτογραφία προφίλ (προαιρετικά), θέση στο γήπεδο.</li>
                  <li><strong className="text-white">Δεδομένα ομάδας:</strong> Όνομα ομάδας, λογότυπο, ιδιότητα μέλους σε ομάδες.</li>
                  <li><strong className="text-white">Αθλητικά στατιστικά:</strong> Γκολ, ασίστ, εμφανίσεις, βραβεία MVP, αποτελέσματα αγώνων.</li>
                  <li><strong className="text-white">Περιεχόμενο χρήστη:</strong> Άρθρα, ανακοινώσεις ή άλλο περιεχόμενο που δημοσιεύετε στην πλατφόρμα.</li>
                  <li><strong className="text-white">Τεχνικά δεδομένα:</strong> Διεύθυνση IP, τύπος προγράμματος περιήγησης, στοιχεία συσκευής, cookies συνεδρίας.</li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 3. Πώς συλλέγουμε */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  3. Πώς Συλλέγουμε τα Δεδομένα
                </h2>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Άμεσα από εσάς:</strong> Κατά τη δημιουργία λογαριασμού, τη συμπλήρωση φόρμας επικοινωνίας ή την ενημέρωση του προφίλ σας.</li>
                  <li><strong className="text-white">Αυτόματα:</strong> Μέσω cookies και παρόμοιων τεχνολογιών κατά την περιήγησή σας στην πλατφόρμα.</li>
                  <li><strong className="text-white">Από τρίτους:</strong> Αν εγγραφείτε μέσω υπηρεσίας τρίτου μέρους (π.χ. Google), ενδέχεται να λαμβάνουμε βασικές πληροφορίες προφίλ από αυτή την υπηρεσία.</li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 4. Σκοπός επεξεργασίας */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  4. Σκοπός Επεξεργασίας
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Χρησιμοποιούμε τα δεδομένα σας για τους εξής σκοπούς:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li>Δημιουργία και διαχείριση του λογαριασμού σας.</li>
                  <li>Διοργάνωση και διαχείριση πρωταθλημάτων, αγώνων και ομάδων.</li>
                  <li>Εμφάνιση στατιστικών παίκτη και αποτελεσμάτων αγώνων.</li>
                  <li>Αποστολή ενημερώσεων και ανακοινώσεων σχετικά με δραστηριότητες της πλατφόρμας.</li>
                  <li>Βελτίωση και ανάπτυξη της πλατφόρμας μας.</li>
                  <li>Εξασφάλιση ασφάλειας και πρόληψη απάτης ή κατάχρησης.</li>
                  <li>Συμμόρφωση με νομικές υποχρεώσεις.</li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 5. Νομική βάση */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  5. Νομική Βάση Επεξεργασίας (GDPR)
                </h2>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Εκτέλεση σύμβασης (Άρθρο 6(1)(β)):</strong> Η επεξεργασία είναι απαραίτητη για την παροχή των υπηρεσιών που ζητήσατε.</li>
                  <li><strong className="text-white">Συγκατάθεση (Άρθρο 6(1)(α)):</strong> Για marketing επικοινωνίες ή προαιρετικές λειτουργίες, ζητούμε την ρητή σας συγκατάθεση.</li>
                  <li><strong className="text-white">Έννομο συμφέρον (Άρθρο 6(1)(στ)):</strong> Για βελτίωση της πλατφόρμας, ανάλυση χρήσης και ασφάλεια του δικτύου.</li>
                  <li><strong className="text-white">Νομική υποχρέωση (Άρθρο 6(1)(γ)):</strong> Όταν η επεξεργασία απαιτείται από την ισχύουσα νομοθεσία.</li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 6. Cookies */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  6. Cookies και Τεχνολογίες Παρακολούθησης
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Χρησιμοποιούμε τα εξής είδη cookies:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Απαραίτητα cookies:</strong> Απαιτούνται για την πιστοποίηση ταυτότητας και την ασφαλή σύνδεσή σας (παρέχονται μέσω Supabase Auth). Δεν μπορούν να απενεργοποιηθούν.</li>
                  <li><strong className="text-white">Αναλυτικά cookies:</strong> Χρησιμοποιούμε το Vercel Analytics και το Vercel Speed Insights για να κατανοούμε πώς χρησιμοποιείται η πλατφόρμα (ανώνυμα δεδομένα επισκεψιμότητας). Φορτώνονται μόνο μετά από τη ρητή συγκατάθεσή σας μέσω του σχετικού banner.</li>
                  <li><strong className="text-white">Ενσωματώσεις τρίτων (YouTube):</strong> Τα ενσωματωμένα βίντεο YouTube στην αρχική σελίδα θέτουν cookies παρακολούθησης. Φορτώνονται μόνο μετά από την ενεργή συγκατάθεσή σας και κλικ στο βίντεο.</li>
                  <li><strong className="text-white">Διευθύνσεις IP (ασφάλεια):</strong> Για την πρόληψη κατάχρησης (rate limiting) συλλέγουμε προσωρινά τη διεύθυνση IP σας. Περισσότερες λεπτομέρειες στην παράγραφο 8 («Διατήρηση Δεδομένων»).</li>
                </ul>
                <p className="text-white/90 leading-relaxed mt-3">
                  Δεν χρησιμοποιούμε cookies διαφήμισης ή cookies τρίτων μερών για προβολή διαφημίσεων. Μπορείτε να διαχειριστείτε τις επιλογές σας οποτεδήποτε από το footer της σελίδας («Ρυθμίσεις Cookies») ή από τις ρυθμίσεις του προγράμματος περιήγησής σας. Δείτε επίσης την{" "}
                  <a href="/cookies" className="text-orange-400 hover:underline">
                    αναλυτική σελίδα Cookies
                  </a>
                  .
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 7. Κοινοποίηση */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  7. Κοινοποίηση Δεδομένων σε Τρίτους
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  <strong className="text-white">Δεν πωλούμε τα δεδομένα σας.</strong> Ενδέχεται να μοιραστούμε δεδομένα με τους εξής αξιόπιστους παρόχους υπηρεσιών, αποκλειστικά για τη λειτουργία της πλατφόρμας:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Supabase:</strong> Βάση δεδομένων, αποθήκευση αρχείων και υπηρεσία πιστοποίησης ταυτότητας.</li>
                  <li><strong className="text-white">Vercel:</strong> Φιλοξενία της πλατφόρμας και ανώνυμα αναλυτικά δεδομένα.</li>
                  <li><strong className="text-white">Web3Forms:</strong> Παραλαβή μηνυμάτων από τη φόρμα επικοινωνίας. Τα δεδομένα της φόρμας (όνομα, email, τηλέφωνο, μήνυμα) προωθούνται μέσω Web3Forms και καταλήγουν στο info@ultrachamp.gr.</li>
                </ul>
                <p className="text-white/90 leading-relaxed mt-3">
                  Όλοι οι πάροχοί μας υπόκεινται σε κατάλληλες συμφωνίες επεξεργασίας δεδομένων και συμμορφώνονται με τον GDPR. Δεν αποκαλύπτουμε δεδομένα σε τρίτους εκτός αν απαιτείται από τον νόμο.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 8. Διατήρηση */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  8. Διατήρηση Δεδομένων
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Διατηρούμε τα δεδομένα σας για όσο χρόνο διατηρείτε ενεργό λογαριασμό στην πλατφόρμα. Εάν ζητήσετε τη διαγραφή του λογαριασμού σας, θα διαγράψουμε ή ανωνυμοποιήσουμε τα προσωπικά σας δεδομένα εντός 30 ημερών, εκτός αν η διατήρησή τους απαιτείται για νομικούς λόγους. Ορισμένα αθλητικά στατιστικά (π.χ. αποτελέσματα αγώνων) ενδέχεται να διατηρηθούν ανωνυμοποιημένα ως ιστορικό αρχείο της πλατφόρμας.
                </p>
                <p className="text-white/90 leading-relaxed mt-3">
                  Οι διευθύνσεις IP που συλλέγονται για σκοπούς ασφάλειας (rate limiting μέσω Vercel KV/Redis) διατηρούνται έως 24 ώρες και στη συνέχεια διαγράφονται αυτόματα. Νομική βάση επεξεργασίας: έννομο συμφέρον (Άρθρο 6(1)(στ) GDPR) για την προστασία της πλατφόρμας από κατάχρηση.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 9. Δικαιώματα */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  9. Τα Δικαιώματά Σας (GDPR)
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Σύμφωνα με τον GDPR, έχετε τα εξής δικαιώματα:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li><strong className="text-white">Πρόσβαση:</strong> Δικαίωμα να λάβετε αντίγραφο των δεδομένων που διατηρούμε για εσάς.</li>
                  <li><strong className="text-white">Διόρθωση:</strong> Δικαίωμα να ζητήσετε τη διόρθωση ανακριβών ή ελλιπών δεδομένων.</li>
                  <li><strong className="text-white">Διαγραφή («δικαίωμα στη λήθη»):</strong> Δικαίωμα να ζητήσετε τη διαγραφή των δεδομένων σας υπό ορισμένες προϋποθέσεις.</li>
                  <li><strong className="text-white">Περιορισμός επεξεργασίας:</strong> Δικαίωμα να ζητήσετε προσωρινό περιορισμό της επεξεργασίας.</li>
                  <li><strong className="text-white">Φορητότητα δεδομένων:</strong> Δικαίωμα να λάβετε τα δεδομένα σας σε δομημένη, ψηφιακή μορφή.</li>
                  <li><strong className="text-white">Εναντίωση:</strong> Δικαίωμα εναντίωσης στην επεξεργασία που βασίζεται σε έννομο συμφέρον.</li>
                  <li><strong className="text-white">Ανάκληση συγκατάθεσης:</strong> Δικαίωμα ανάκλησης οποιασδήποτε συγκατάθεσης δώσατε ανά πάσα στιγμή.</li>
                </ul>
                <p className="text-white/90 leading-relaxed mt-3">
                  Για να ασκήσετε οποιοδήποτε από τα παραπάνω δικαιώματα, επικοινωνήστε μαζί μας στο{" "}
                  <a href="mailto:info@ultrachamp.gr" className="text-orange-400 hover:underline">
                    info@ultrachamp.gr
                  </a>
                  . Έχετε επίσης δικαίωμα να υποβάλετε καταγγελία στην{" "}
                  <strong className="text-white">Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (ΑΠΔΠΧ)</strong> στο{" "}
                  <a href="https://www.dpa.gr" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                    www.dpa.gr
                  </a>
                  .
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 10. Ασφάλεια */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  10. Ασφάλεια Δεδομένων
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Εφαρμόζουμε κατάλληλα τεχνικά και οργανωτικά μέτρα για την προστασία των δεδομένων σας από μη εξουσιοδοτημένη πρόσβαση, αποκάλυψη, τροποποίηση ή καταστροφή. Αυτά περιλαμβάνουν κρυπτογράφηση δεδομένων κατά τη μεταφορά (HTTPS/TLS), κρυπτογράφηση κωδικών πρόσβασης και ασφαλή φιλοξενία μέσω Supabase και Vercel. Παρόλα αυτά, καμία μέθοδος μετάδοσης δεδομένων στο διαδίκτυο δεν είναι απολύτως ασφαλής.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 11. Ανήλικοι */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  11. Ανήλικοι
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Η πλατφόρμα μας δεν απευθύνεται σε άτομα κάτω των 16 ετών. Δεν συλλέγουμε εν γνώσει μας προσωπικά δεδομένα ατόμων κάτω αυτής της ηλικίας χωρίς τη συγκατάθεση γονέα ή κηδεμόνα. Εάν πιστεύετε ότι ένα ανήλικο άτομο έχει παράσχει δεδομένα χωρίς άδεια, επικοινωνήστε μαζί μας άμεσα.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 12. Αλλαγές */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  12. Αλλαγές στην Πολιτική Απορρήτου
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Ενδέχεται να ενημερώνουμε περιοδικά την παρούσα Πολιτική. Σε περίπτωση ουσιαστικών αλλαγών, θα σας ενημερώνουμε μέσω email ή με εμφανή ειδοποίηση στην πλατφόρμα. Η συνέχιση χρήσης της πλατφόρμας μετά την ανάρτηση αλλαγών αποτελεί αποδοχή της ενημερωμένης Πολιτικής.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 13. Επικοινωνία */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  13. Επικοινωνία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Για οποιαδήποτε απορία σχετικά με την παρούσα Πολιτική ή τη διαχείριση των προσωπικών σας δεδομένων, μπορείτε να επικοινωνήσετε μαζί μας:
                </p>
                <ul className="list-none mt-3 space-y-1 text-white/90">
                  <li>
                    <strong className="text-white">Email:</strong>{" "}
                    <a href="mailto:info@ultrachamp.gr" className="text-orange-400 hover:underline">
                      info@ultrachamp.gr
                    </a>
                  </li>
                  <li>
                    <strong className="text-white">Φόρμα επικοινωνίας:</strong>{" "}
                    <a href="/epikoinonia" className="text-orange-400 hover:underline">
                      ultrachamp.gr/epikoinonia
                    </a>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

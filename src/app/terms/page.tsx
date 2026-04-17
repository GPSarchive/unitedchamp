import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import VantaBg from "@/app/lib/VantaBg";

export const metadata: Metadata = {
  title: "Όροι Χρήσης | UltraChamp.gr",
  description:
    "Οι όροι χρήσης της πλατφόρμας UltraChamp.gr για πρωταθλήματα mini football.",
};

export default function TermsPage() {
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
            Όροι Χρήσης
          </h1>
          <p className="mt-3 text-white/60 text-center max-w-lg text-sm sm:text-base">
            Οι κανόνες χρήσης της πλατφόρμας UltraChamp.gr.
          </p>
          <p className="mt-2 text-white/40 text-center text-xs">
            Τελευταία ενημέρωση: Απρίλιος 2026
          </p>
        </div>

        {/* ── Content ── */}
        <div className="container mx-auto px-4 pb-16 max-w-4xl">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-10 shadow-2xl">
            <div className="space-y-10">

              {/* 1. Εισαγωγή / Αποδοχή */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  1. Εισαγωγή / Αποδοχή Όρων
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Καλώς ήρθατε στο <strong className="text-white">UltraChamp.gr</strong>. Η
                  χρήση της πλατφόρμας προϋποθέτει ότι έχετε διαβάσει, κατανοήσει
                  και αποδεχτεί τους παρόντες Όρους Χρήσης, καθώς και την{" "}
                  <Link href="/privacy" className="text-orange-400 hover:underline">
                    Πολιτική Απορρήτου
                  </Link>{" "}
                  μας. Αν δεν συμφωνείτε με οποιονδήποτε όρο, παρακαλούμε μη
                  χρησιμοποιείτε την πλατφόρμα.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 2. Ορισμοί */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  2. Ορισμοί
                </h2>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li>
                    <strong className="text-white">«Πλατφόρμα»:</strong> ο ιστότοπος
                    και οι υπηρεσίες του UltraChamp.gr.
                  </li>
                  <li>
                    <strong className="text-white">«Χρήστης»:</strong> κάθε φυσικό
                    πρόσωπο που επισκέπτεται ή χρησιμοποιεί την Πλατφόρμα, εγγεγραμμένο
                    ή μη.
                  </li>
                  <li>
                    <strong className="text-white">«Περιεχόμενο»:</strong> κείμενα,
                    εικόνες, στατιστικά, ανακοινώσεις, άρθρα και κάθε άλλο υλικό που
                    δημοσιεύεται στην Πλατφόρμα.
                  </li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 3. Εγγραφή & ηλικία */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  3. Εγγραφή Λογαριασμού &amp; Ηλικία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Η εγγραφή απαιτεί ελάχιστη ηλικία 16 ετών. Για ανήλικους
                  κάτω των 16 ετών απαιτείται η συγκατάθεση γονέα ή κηδεμόνα.
                  Είστε υπεύθυνοι για την ακρίβεια των στοιχείων που δηλώνετε
                  κατά την εγγραφή και για τη διατήρηση της εμπιστευτικότητας
                  του κωδικού σας. Κάθε δραστηριότητα που πραγματοποιείται μέσω
                  του λογαριασμού σας θεωρείται δική σας ευθύνη.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 4. Υποχρεώσεις χρήστη */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  4. Υποχρεώσεις Χρήστη
                </h2>
                <p className="text-white/90 leading-relaxed mb-3">
                  Συμφωνείτε ότι δεν θα:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/90 ml-2">
                  <li>Χρησιμοποιήσετε την Πλατφόρμα για παράνομους σκοπούς.</li>
                  <li>
                    Δηλώσετε ψευδή στοιχεία ή προσωποποιήσετε άλλο πρόσωπο ή οντότητα.
                  </li>
                  <li>
                    Επιχειρήσετε να αποκτήσετε μη εξουσιοδοτημένη πρόσβαση σε
                    συστήματα, δεδομένα ή λογαριασμούς άλλων χρηστών.
                  </li>
                  <li>
                    Διαταράξετε τη λειτουργία της Πλατφόρμας (π.χ. μέσω DoS,
                    scraping υπερβολικής συχνότητας, αυτοματισμών χωρίς άδεια).
                  </li>
                  <li>
                    Παραβείτε κανόνες fair-play ή τον{" "}
                    <Link href="/kanonismos" className="text-orange-400 hover:underline">
                      Κανονισμό
                    </Link>{" "}
                    των διοργανώσεων.
                  </li>
                </ul>
              </div>

              <hr className="border-white/10" />

              {/* 5. Κανόνες περιεχομένου */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  5. Κανόνες Περιεχομένου
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Το περιεχόμενο που αναρτάτε (άρθρα, φωτογραφίες, σχόλια κ.λπ.)
                  πρέπει να σέβεται πνευματικά δικαιώματα τρίτων, να μην
                  περιέχει προσβλητικό, παράνομο ή συκοφαντικό υλικό και να μην
                  παραβιάζει την ιδιωτικότητα άλλων. Διατηρούμε το δικαίωμα να
                  αφαιρέσουμε οποιοδήποτε περιεχόμενο κρίνουμε ότι παραβιάζει τους
                  παρόντες όρους ή την κείμενη νομοθεσία.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 6. Αθλητικοί κανονισμοί */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  6. Αθλητικοί Κανονισμοί
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Οι κανόνες διεξαγωγής αγώνων και διοργανώσεων περιγράφονται στον{" "}
                  <Link href="/kanonismos" className="text-orange-400 hover:underline">
                    Κανονισμό
                  </Link>
                  . Η συμμετοχή σε πρωταθλήματα προϋποθέτει την αποδοχή του
                  ισχύοντος κανονισμού.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 7. Πνευματική ιδιοκτησία */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  7. Πνευματική Ιδιοκτησία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Το σύνολο της Πλατφόρμας (λογισμικό, γραφικά, λογότυπα,
                  σχεδιαστικά στοιχεία) αποτελεί πνευματική ιδιοκτησία του
                  UltraChamp.gr και των δικαιούχων της. Απαγορεύεται η
                  αναπαραγωγή, τροποποίηση ή εμπορική εκμετάλλευση χωρίς γραπτή
                  άδεια. Για το περιεχόμενο που αναρτάτε εσείς, παραχωρείτε στο
                  UltraChamp.gr μη αποκλειστική άδεια χρήσης αποκλειστικά για τη
                  λειτουργία και προβολή της Πλατφόρμας.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 8. Αποποίηση ευθύνης */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  8. Αποποίηση &amp; Περιορισμός Ευθύνης
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Η Πλατφόρμα παρέχεται «ως έχει» («as is») χωρίς εγγύηση
                  αδιάλειπτης λειτουργίας ή απαλλαγής από σφάλματα. Καταβάλλουμε
                  εύλογες προσπάθειες για ακρίβεια των στατιστικών και των
                  αποτελεσμάτων, αλλά δεν φέρουμε ευθύνη για έμμεσες ή
                  επακόλουθες ζημίες από τη χρήση της Πλατφόρμας, στο μέτρο που
                  επιτρέπει το εφαρμοστέο δίκαιο.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 9. Τερματισμός */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  9. Τερματισμός Λογαριασμού
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Διατηρούμε το δικαίωμα να αναστείλουμε ή να τερματίσουμε τον
                  λογαριασμό σας σε περίπτωση παραβίασης των παρόντων όρων ή
                  κακόβουλης χρήσης της Πλατφόρμας. Μπορείτε επίσης να ζητήσετε
                  τη διαγραφή του λογαριασμού σας οποιαδήποτε στιγμή στέλνοντας
                  email στο{" "}
                  <a
                    href="mailto:info@ultrachamp.gr"
                    className="text-orange-400 hover:underline"
                  >
                    info@ultrachamp.gr
                  </a>
                  .
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 10. Τροποποιήσεις */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  10. Τροποποιήσεις Όρων
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Μπορούμε να ενημερώνουμε περιοδικά τους παρόντες Όρους. Σε
                  περίπτωση ουσιαστικών αλλαγών θα σας ειδοποιούμε μέσω της
                  Πλατφόρμας ή με email. Η συνέχιση χρήσης μετά τη δημοσίευση
                  αλλαγών αποτελεί αποδοχή των ενημερωμένων όρων.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 11. Εφαρμοστέο δίκαιο */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  11. Εφαρμοστέο Δίκαιο &amp; Δικαιοδοσία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Οι παρόντες Όροι διέπονται από το ελληνικό δίκαιο. Για κάθε
                  διαφορά που ενδέχεται να προκύψει, αρμόδια ορίζονται τα
                  δικαστήρια της Αθήνας, με επιφύλαξη των αναγκαστικής ισχύος
                  διατάξεων της ενωσιακής νομοθεσίας περί προστασίας των
                  καταναλωτών.
                </p>
              </div>

              <hr className="border-white/10" />

              {/* 12. Επικοινωνία */}
              <div>
                <h2 className="text-xl font-bold text-orange-400 mb-3">
                  12. Επικοινωνία
                </h2>
                <p className="text-white/90 leading-relaxed">
                  Για κάθε απορία ή παρατήρηση σχετικά με τους παρόντες Όρους,
                  μπορείτε να επικοινωνήσετε μαζί μας:
                </p>
                <ul className="list-none mt-3 space-y-1 text-white/90">
                  <li>
                    <strong className="text-white">Email:</strong>{" "}
                    <a
                      href="mailto:info@ultrachamp.gr"
                      className="text-orange-400 hover:underline"
                    >
                      info@ultrachamp.gr
                    </a>
                  </li>
                  <li>
                    <strong className="text-white">Φόρμα επικοινωνίας:</strong>{" "}
                    <Link
                      href="/epikoinonia"
                      className="text-orange-400 hover:underline"
                    >
                      ultrachamp.gr/epikoinonia
                    </Link>
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

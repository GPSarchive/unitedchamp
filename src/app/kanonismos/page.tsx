// app/kanonismos/page.tsx
import Image from "next/image";
import VantaBg from "@/app/lib/VantaBg";

export const metadata = { title: "Κανονισμός" };

export default function KanonismosPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background that stays in place while content scrolls */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content scrolling over the fixed background */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Logo Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-32 h-32 mb-4">
              <Image
                src="/UltraChampLogo.png"
                alt="UltraChamp Logo"
                fill
                className="object-contain drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]"
                priority
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-center text-white tracking-tight mb-2">
              Κανονισμός Διεξαγωγής Αγώνων Πρωταθλήματος
            </h1>
            <h2 className="text-xl sm:text-2xl font-semibold text-center text-orange-400/90 tracking-wide">
              Διοργανώσεων ULTRACHAMP
            </h2>
          </div>

          {/* Rules Container */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl">
            <div className="space-y-6">
              {/* Rule 1 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    1
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Οι ομάδες αγωνίζονται με τη μορφή 4 παίκτες +1 τερματοφύλακας στη μορφή 5x5.
                  </p>
                </div>
              </div>

              {/* Rule 2 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    2
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Οι ομάδες αγωνίζονται με τη μορφή 5 παίκτες +1 τερματοφύλακας στη μορφή 6x6.
                  </p>
                </div>
              </div>

              {/* Rule 3 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    3
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Οι ομάδες αγωνίζονται με τη μορφή 6 παίκτες +1 τερματοφύλακας στη μορφή 7x7.
                  </p>
                </div>
              </div>

              {/* Rule 4 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    4
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Ο αγώνας δύναται να ξεκινήσει με ν-2 παίκτες στην εκάστοτε μορφή.
                  </p>
                </div>
              </div>

              {/* Rule 5 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    5
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση που μία ομάδα παρουσιαστεί με ν-3 παίκτες στην εκάστοτε μορφή, ο αγώνας δεν πραγματοποιείται. Ο αγώνας πιστώνεται με 3-0 στην αντίπαλη ομάδα και υπάρχει ποινή αφαίρεσης 2 βαθμών.
                  </p>
                </div>
              </div>

              {/* Rule 6 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    6
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση που μία ομάδα παραταχθεί ή βρεθεί κατά τη διάρκεια του αγώνα με ν-3 παίκτες, η νίκη ορίζεται με 3-0 για την αντίπαλη ομάδα και υπάρχει ποινή -2 βαθμούς για το σωματείο στη βαθμολογία.
                  </p>
                </div>
              </div>

              {/* Rule 7 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    7
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Διάρκεια αγώνα πρωταθλημάτων : 2 ημίχρονα των 25 λεπτών μεικτού χρόνου + καθυστερήσεις.
                  </p>
                </div>
              </div>

              {/* Rule 8 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    8
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Διάρκεια αγώνων κυπέλλου Αθήνας : 2 ημίχρονα των 25 λεπτών μεικτού χρόνου + καθυστερήσεις.
                  </p>
                </div>
              </div>

              {/* Rule 9 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    9
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Διάρκεια αγώνων event κυπέλλων: Ορίζονται ανά περίπτωση από την διοργανώτρια αρχή.
                  </p>
                </div>
              </div>

              {/* Rule 10 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    10
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση καθυστέρησης έναρξης του αγώνα με την υπαιτιότητα ομάδας, ο χρόνος παιχνιδιού αφαιρείται από τον αγώνα.
                  </p>
                </div>
              </div>

              {/* Rule 11 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    11
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση καθυστέρησης έναρξης του αγώνα με υπαιτιότητα κάποιας ομάδας: Στα 10 λεπτά καθυστέρησης, έναρξη αγώνα με σκορ 1-0 για την αντίπαλη ομάδα. Στα 15 λεπτά καθυστέρησης, έναρξη αγώνα με σκορ 2-0 για την αντίπαλη ομάδα. Στα 20 λεπτά καθυστέρησης, έναρξη αγώνα με σκορ 3-0 για την αντίπαλη ομάδα και λήξη αγώνα. Τιμωρία αφαίρεσης 2 βαθμών για την αργοπορημένη ομάδα.
                  </p>
                </div>
              </div>

              {/* Rule 12 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    12
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Κάθε ομάδα έχει δικαίωμα ενός time out, ανά ημίχρονο, διάρκειας 1 λεπτού, το οποίο 1 λεπτό αφαιρείται από τον αγωνιστικό χρόνο.
                  </p>
                </div>
              </div>

              {/* Rule 13 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    13
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Στα τελευταία 5 κάθε ημιχρόνου, δεν δύναται η ομάδα να κάνει time out.
                  </p>
                </div>
              </div>

              {/* Rule 14 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    14
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Δεν επιτρέπονται τα τάκλιν πάνω σε αντίπαλο (απόσταση 1 μέτρου). Το τάκλιν αποτελεί τιμωρία με κίτρινη κάρτα.*,όταν υπάρχει πρόθεση.
                  </p>
                </div>
              </div>

              {/* Rule 15 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    15
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση ακούσιο γλιστρήματος πάνω στον αντίπαλο, δεν δίνεται κάρτα αλλά μόνο η παράβαση.
                  </p>
                </div>
              </div>

              {/* Rule 16 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    16
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    *Εξαίρεση αποτελεί το τάκλιν του τερματοφύλακα μέσα στη περιοχή του, το οποίο επιτρέπεται.
                  </p>
                </div>
              </div>

              {/* Rule 17 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    17
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Τα τάκλιν στον χώρο σε απόσταση 1 μέτρου από αντίπαλο επιτρέπονται.
                  </p>
                </div>
              </div>

              {/* Rule 18 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    18
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Όλα τα φάουλ εκτελούνται ως άμεσα (1 touch)**
                  </p>
                </div>
              </div>

              {/* Rule 19 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    19
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    ** εξαίρεση 1: Η σύλληψη ή άγγιγμα της μπάλας από το τερματοφύλακα με τα χέρια, όταν η επιστροφή γίνεται με πρόθεση με μέρος του ποδιού κάτω από το γόνατο, από συμπαίκτη. Στη περίπτωση αυτή δίνεται έμμεσο φάουλ (2 αγγίγματα) Αν ακουμπήσει η μπάλα μόνο το δοκάρι, δεν θεωρείται έμμεσο φάουλ αλλά άμεσο. ***
                  </p>
                </div>
              </div>

              {/* Rule 20 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    20
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Τα πλάγια άουτ εκτελούνται με το πόδι και είναι έμμεσα.
                  </p>
                </div>
              </div>

              {/* Rule 21 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    21
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Η μπάλα στα πλάγια άουτ πρέπει να είναι σταθερή κατά την εκτέλεση. Διαφορετικά δίνεται αλλαγή κατοχής.
                  </p>
                </div>
              </div>

              {/* Rule 22 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    22
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Τα άουτ γραμμής τέρματος εκτελούνται με τα χέρια και μόνο από τον τερματοφύλακα.
                  </p>
                </div>
              </div>

              {/* Rule 23 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    23
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Στα πλάγια γραμμής τέρματος, ο τερματοφύλακας δύναται να τοποθετήσει την μπάλα κάτω και να παίξει σε φυσική ροή. Όμως οι επιτιθέμενοι σε αυτή την περίπτωση δύνανται να σκοράρουν κανονικά.
                  </p>
                </div>
              </div>

              {/* Rule 24 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    24
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    *** εξαίρεση 2: Αν ο τερματοφύλακας ξαναπιάσει την μπάλα μετά την τοποθέτηση της μπάλας στο έδαφος κατά την εκτέλεση του άουτ γραμμής τέρματος, είναι έμμεσο φάουλ στο σημείο της παράβασης.
                  </p>
                </div>
              </div>

              {/* Rule 25 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    25
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Χρόνος εκτέλεσης πλαγίων, κόρνερ, ελεύθερου λακτίσματος , είναι τα 5 δευτερόλεπτα.
                  </p>
                </div>
              </div>

              {/* Rule 26 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    26
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση καθυστέρησης, το πλάγιο άουτ δίνεται αλλαγή για την αντίπαλη ομάδα. Το κόρνερ δίνεται άουτ γραμμής τέρματος για την αντίπαλη ομάδα. Το άουτ γραμμής τέρματος δίνεται κόρνερ για την αντίπαλη ομάδα.
                  </p>
                </div>
              </div>

              {/* Rule 27 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    27
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση ύπαρξης δικτύου οροφής, το παιχνίδι διακόπτεται και ο διαιτητής ορίζει πλάγιο άουτ στο κοντινότερο σημείο για την αντίπαλη ομάδα.
                  </p>
                </div>
              </div>

              {/* Rule 28 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    28
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Μπάλα που κυλάει κατά την εκτέλεση κόρνερ ή φάουλ, δίνεται επανάληψη. Σε περίπτωση επανάληψης του κυλίσματος, δίνεται αλλαγή κατοχής (κόρνερ σε άουτ γραμμής τέρματος, φάουλ σε φάουλ στο ίδιο σημείο).
                  </p>
                </div>
              </div>

              {/* Rule 29 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    29
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Η κίτρινη κάρτα δίνεται από τον διαιτητή σε περιπτώσεις τάκλιν με πρόθεσης πάνω στον αντίπαλο παίκτη, τραβήγματος φανέλας, ήπιου ξεκάθαρου χτυπήματος στο σώμα αντιπάλου, ήπιας διαμαρτυρίας, τραβήγματος φανέλας, ήπιας μη ευγενούς συμπεριφοράς, διακοπής πορείας μπάλας με πρόθεση με το χέρι σε σημείου που το χέρι δεν εφάπτεται με το σώμα του παίκτη, σε περίπτωση μη ορθολογικής διαδικασίας αλλαγής παίκτη, σε περίπτωση μη ορθολογικής διακοπής φυσικής ροής αγώνα, καθώς και σε περίπτωση διαπληκτισμού.
                  </p>
                </div>
              </div>

              {/* Rule 30 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    30
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Ο διαιτητής δύναται και σε άλλες περιπτώσεις που θα κρίνει σκόπιμο να δείξει την κίτρινη κάρτα.
                  </p>
                </div>
              </div>

              {/* Rule 31 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    31
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Δεύτερη κίτρινη κάρτα ισοδυναμεί με μπλε κάρτα.
                  </p>
                </div>
              </div>

              {/* Rule 32 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    32
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Η μπλε κάρτα αφορά την 5λεπτη αποβολή του παίκτη στη μορφή 6x6 και 7x7. Για 5 λεπτά η ομάδα αγωνίζεται με παίκτη λιγότερο. Με την πάροδο των 5 λεπτών ο διαιτητής ενημερώνει και ο παίκτης «εισβάλλει» στη φυσική ροή από το κέντρο του γηπέδου με υπόδειξη του διαιτητή. Μπορεί να ενταχθεί ο ίδιος ή διαφορετικός παίκτης.
                  </p>
                </div>
              </div>

              {/* Rule 33 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    33
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Η μπλε κάρτα αφορά την 2λεπτη αποβολή του παίκτη στη μορφή 5x5. Για 2 λεπτά η ομάδα αγωνίζεται με παίκτη λιγότερο. Με την πάροδο των 2 λεπτών ο διαιτητής ενημερώνει και ο παίκτης «εισβάλλει» στη φυσική ροή από το κέντρο του γηπέδου με υπόδειξη του διαιτητή. Μπορεί να ενταχθεί ο ίδιος ή διαφορετικός παίκτης.
                  </p>
                </div>
              </div>

              {/* Rule 34 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    34
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Μπλε κάρτα ο διαιτητής υποδεικνύει απευθείας σε σκληρό μαρκάρισμα και συμπεριφορές που κρίνει ότι δεν επιτρέπονται εντός αγωνιστικού χώρου με σκοπό την συμμόρφωση και την επαναφορά του παίκτη. Επίσης όταν παίκτης διακόψει με μη αποδεκτό τρόπο καθαρή ευκαιρία για γκολ.
                  </p>
                </div>
              </div>

              {/* Rule 35 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    35
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Ο διαιτητής δύναται και σε άλλες περιπτώσεις που θα κρίνει σκόπιμο να επιδείξει την μπλε κάρτα.
                  </p>
                </div>
              </div>

              {/* Rule 36 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    36
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Μετά την επίδειξη μπλε κάρτας , ο παίκτης μπορεί να τιμωρηθεί μόνο με μπλε ή κόκκινη κάρτα σε επόμενη παράβαση. Στην περίπτωση 2 μπλε καρτών, ο παίκτης αποβάλλεται από τον συγκεκριμένο αγώνα και η ομάδα αγωνίζεται με παίκτη λιγότερο για 5 λεπτά στη μορφή 6/7 και για 2 λεπτά στην μορφή 5. Στη συνέχεια δύναται να τον αντικαταστήσει.
                  </p>
                </div>
              </div>

              {/* Rule 37 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    37
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Η κόκκινη κάρτα αφορά τις βίαιες, επιθετικές συμπεριφορές και τα πολύ επικίνδυνα μαρκαρίσματα. Στην περίπτωση κόκκινης κάρτας ο παίκτης χάνει αυτό και το επόμενο παιχνίδι. Η ομάδα αγωνίζεται για όλο το παιχνίδι με παίκτη λιγότερο. Σε πολύ σοβαρές περιπτώσεις η διοργάνωση κρίνει κατά βούληση και τροποποιεί την τιμωρία της ομάδας και του παίκτη.
                  </p>
                </div>
              </div>

              {/* Rule 38 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    38
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Βάσει της σοβαρότητας της κατάστασης ο διοργάνωση δύναται να τιμωρήσει έναν παίκτη με 1 έως 7 αγωνιστικές, αλλά και με την οριστική αποβολή του παίκτη από την διοργάνωση, και κατά επέκταση την ομάδας στην οποία αγωνίζεται ο παίκτης.
                  </p>
                </div>
              </div>

              {/* Rule 39 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    39
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Οι κάρτες αποτελούν τον οργανωτικό εξοπλισμό του διαιτητή και μπορεί εκτός των παραπάνω να τις αξιοποιήσει ορθολογικά κατά βούληση.
                  </p>
                </div>
              </div>

              {/* Rule 40 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    40
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Φάουλ εντός της περιοχής του τερματοφύλακα έναντι της αντίπαλης ομάδας αποτελεί πέναλτι.
                  </p>
                </div>
              </div>

              {/* Rule 41 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    41
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Στο πέναλτι η μπάλα τοποθετείται 1 μέτρο εκτός της γραμμής περιοχής του τερματοφύλακα. Ο επιτιθέμενος επιτρέπεται να πάρει φόρα. Ο τερματοφύλακας υποχρεούται να πατάει την γραμμή τέρματος έστω με το 1 πόδι κατά την εκτέλεση του πέναλτι από τον επιτιθέμενο.
                  </p>
                </div>
              </div>

              {/* Rule 42 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    42
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση που ο τερματοφύλακας δεν τηρεί τον κανόνα έχουμε επανάληψη της εκτέλεσης.
                  </p>
                </div>
              </div>

              {/* Rule 43 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    43
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Οι αλλαγές γίνονται όταν η ομάδα έχει την κατοχή της μπάλας στους νεκρούς χρόνους και πρέπει να εγκριθούν από τον διαιτητή.
                  </p>
                </div>
              </div>

              {/* Rule 44 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    44
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Δεν υπάρχει αριθμητικό , χρονικό , ποσοτικό όριο στις αλλαγές.
                  </p>
                </div>
              </div>

              {/* Rule 45 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    45
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Για την αλλαγή ο διαιτητής διακόπτει και επαναφέρει την ροή του αγώνα.
                  </p>
                </div>
              </div>

              {/* Rule 46 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    46
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση πραγματοποίησης αλλαγής με τον μη αναγραφόμενο τρόπο, ο διαιτητής, δύναται να τιμωρήσει τον παίκτη που εισέρχεται με κίτρινη κάρτα και να ακυρώσει την αλλαγή.
                  </p>
                </div>
              </div>

              {/* Rule 47 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    47
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Κατά την λήξη εκάστου ημιχρόνου , ο διαιτητής ενημερώνει πώς παίζεται η τελευταία φάση. Σε περίπτωση που η φάση ολοκληρωθεί σε πλάγιο άουτ, άουτ γραμμής τέρματος ή κόρνερ ή γκολ, ο αγώνας λήγει. Σε περίπτωση που πραγματοποιηθεί φάουλ ή πέναλτι , πρέπει να ολοκληρωθεί και αυτή η ενέργεια.
                  </p>
                </div>
              </div>

              {/* Rule 48 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    48
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Δεν δύναται να λήξει ο αγώνας στην τελευταία φάση με απευθείας άουτ τερματοφύλακα (ούτε δια χειρός ούτε δια λακτίσματος).
                  </p>
                </div>
              </div>

              {/* Rule 49 */}
              <div className="group">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-400 font-bold text-sm">
                    49
                  </span>
                  <p className="flex-1 text-white/90 leading-relaxed pt-1">
                    Σε περίπτωση που ο διαιτητής ή η διοργάνωση ή το γήπεδο διακόψουν έναν αγώνα , η διοργάνωση είναι αποκλειστικά υπεύθυνη για να ορίσει την έκβαση της κατάστασης ανά περιστατικό.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              © 2025 Ultra Champ. Όλα τα δικαιώματα διατηρούνται.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

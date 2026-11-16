// «Άρθρα & Ανακοινώσεις»: the list itself is a client component (it fetches
// articles and announcements in the browser).
import ArticlesListClient from "./ArticlesListClient";

export const metadata = {
  title: "Άρθρα & Ανακοινώσεις",
};

export default function ArticlesPage() {
  return <ArticlesListClient />;
}

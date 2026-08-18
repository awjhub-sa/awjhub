import UsersPage from './UsersPage.jsx';

/* The observers' half of UsersPage. Both roles share the forms and the edit
   dialog because that work genuinely is the same; the columns and the counts
   are not, and those follow the role. */
export default function AdminObservers() {
  return <UsersPage role="observer" />;
}

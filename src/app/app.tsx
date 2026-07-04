// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import { ThemeProvider } from 'styled-components';

import NxWelcome from './nx-welcome';
import { theme } from '../styles/theme';
import { GlobalStyle } from '../styles/GlobalStyle';

import { Route, Routes, Link } from 'react-router-dom';

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <div>
        <NxWelcome title="familyflix" />

        {/* START: routes */}
        {/* These routes and navigation have been generated for you */}
        {/* Feel free to move and update them to fit your needs */}
        <br />
        <hr />
        <br />
        <div role="navigation">
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/page-2">Page 2</Link>
            </li>
          </ul>
        </div>
        <Routes>
          <Route
            path="/"
            element={
              <div>
                This is the generated root route.{' '}
                <Link to="/page-2">Click here for page 2.</Link>
              </div>
            }
          />
          <Route
            path="/page-2"
            element={
              <div>
                <Link to="/">Click here to go back to root page.</Link>
              </div>
            }
          />
        </Routes>
        {/* END: routes */}
      </div>
    </ThemeProvider>
  );
}

export default App;

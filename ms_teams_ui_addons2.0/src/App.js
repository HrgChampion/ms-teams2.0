import './App.css';
import SearchBarOne from './SearchBars/SearchBarOne';
 import SearchBarTwo from './SearchBars/SearchBarTwo';
import SearchBarThree from './SearchBars/SearchBarThree';
function App() {
  return (
    <div className="App">
      <h1>Beagle 2.0</h1>
      <SearchBarOne/>
      <SearchBarTwo/>
      <SearchBarThree/>
    </div>
  );
}

export default App;

import './App.css';
import SearchBarOne from './SearchBars/SearchBarOne';
 import SearchBarTwo from './SearchBars/SearchBarTwo';
import SearchBarThree from './SearchBars/SearchBarThree';
import SearchBarFour from './SearchBars/SearchBarFour';
function App() {
  return (
    <div className="App">
      <h1>Beagle 2.0</h1>
      <SearchBarOne/>
      
      <SearchBarThree/>
      <SearchBarFour/>
      <SearchBarTwo/>
      <div className='space'></div>

    </div>
  );
}

export default App;

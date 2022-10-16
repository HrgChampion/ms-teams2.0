import * as React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import { useState,useEffect } from "react";

import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import './SearchBarThree.css'



export default function SearchBarFour() {
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('')

   
    function handleChange(e){
        
       setSearchTerm(e.target.value)
       
    }
    async function fetchSearchResults(query){
        try{
            
           

            let data=await response.json();

            let videos=data.items;
            console.log(videos)
           setResults(videos)
        
        }catch(e){
            console.log("e:",e)
        }
    }
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
          console.log(searchTerm)
          // Send Axios request here
          fetchSearchResults(searchTerm)
        }, 3000)
    
        return () => clearTimeout(delayDebounceFn)
      }, [searchTerm])

  return (
      <>
      <h1>API Search Optimized</h1>
    <Stack spacing={3} sx={{ width: 500 }}>
    <div className="results">
      <Autocomplete
        multiple
        id="tags-standard"
        options={results}
        getOptionLabel={(option) => option.snippet.title}
        // defaultValue={[results.length>0?results[0]:[]]}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            label="Multiple values"
            placeholder="Favorites"
            onChange={handleChange}
          />
        )}
      />
      <div className="btn">
       <Button variant="contained" endIcon={<SendIcon />} >
        Send
      </Button>
      </div>
      </div>
    </Stack>
    </>
  );
}
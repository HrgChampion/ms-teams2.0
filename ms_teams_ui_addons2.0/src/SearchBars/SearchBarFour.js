import * as React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import { useState,useEffect } from "react";

import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import './SearchBarThree.css'
import { Chip } from "@mui/material";


export default function SearchBarFour() {
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('')
  const [values,setvalues]=useState([])
  const [newvalues,setnewvalues]=useState([])
  function handleClick(){
    console.log(1)
    console.log("click",values)
    setnewvalues(values)
  }
   
    function handleChange(e){
        
       setSearchTerm(e.target.value)
       
    }
    async function fetchSearchResults(query){
        try{
            
          

            let data=await response.json();

            let videos=data.items.map(video=>video.snippet.title);
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
        id="tags-filled"
        options={results}
        // defaultValue={[top100Films[13].title]}
        freeSolo
        renderTags={(value, getTagProps) =>{ 
          setvalues(value)
          console.log(value)
        return  value.map((option, index) => (
            <Chip variant="outlined" label={option} {...getTagProps({ index })} />
          ))
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="filled"
            label="freeSolo"
            placeholder="Favorites"
            onChange={handleChange}
          />
        )}
      />
      <div className="btn">
       <Button variant="contained" endIcon={<SendIcon />} onClick={handleClick}>
        Send
      </Button>
      </div>
      {newvalues.map(d=><div>{d}</div>)}
      </div>
    </Stack>
    </>
  );
}
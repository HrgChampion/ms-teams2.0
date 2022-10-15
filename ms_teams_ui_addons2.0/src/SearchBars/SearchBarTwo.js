import "./SEarchBarTwo.css"
export default function SearchBarTwo(){
    let wait;
    function debounce(func,delay){
       
        
        if(wait){
            clearTimeout(wait);
        }

        wait=setTimeout(()=>{
            func()
        },delay)
    }
    async function searchVideo(){
        try{
            let video_query=document.getElementById("video").value;
            let response=await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${video_query}&type=video&key=AIzaSyC1G_MC-DeBLd5rpMe2wpLqvIy5makFREM&maxResults=20&safeSearch=strict&q=${video_query}`);
            let data=await response.json();

            let videos=data.items;
        //    appendVideos(videos)
            
            console.log("data:",data)
        }catch(e){
            console.log("e:",e)
        }
    }
    const appendVideos=(items) =>{
    
        items.forEach(element => {
            let {snippet}=element;
            console.log("snippet:",snippet);
          
            return ( 
          <div >
            <p>{snippet.title}</p>

           <img src={snippet.thumbnails.medium.url}/>
               
            </div>


            )
        });
        
    }
   

    return(
        <div>
        <div className="searchBarTwo">
        <input oninput={debounce(searchVideo,1000)} type="text" id="video"/>
    <button onclick={searchVideo()}>Search</button>
        </div>
        </div>
    )
}



$(document).ready(function(){
    $(".n-float").on("input",function(){
        this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    });
    
    $(".n-fraction").on("input",function(){
        this.value = this.value.replace(/(?:[1-9][0-9]*|0)\/[1-9][0-9]*/g, '').replace(/(\..*)\./g, '$1');
    });
    
    $(".n-int").on("input",function(){
        this.value = this.value.replace(/[^0-9.]/g, '');
    });
});